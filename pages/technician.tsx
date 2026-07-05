import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/sidebar';
import { useToast } from '../components/ui/ToastProvider';
import Button from '../components/ui/Button';
import { getGraceDaysLeft, hasSubscriptionAccess, hasOutstandingPaymentFailure } from '../lib/subscriptionAccess';
import { isValidUkPostcode } from '../lib/ukPostcode';
import { usePermissions } from '../hooks/usePermissions';
import { useLocale } from '../lib/hooks/useLocale';
import OnboardingModal, { isTechnicianOnboardingDismissed } from '../components/OnboardingModal';

type TechnicianProfile = {
  id: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  /** ISO 3166-1 alpha-2 country code set by the company owner, or null if unset. */
  companyCountry: string | null;
};

type LogbookEntry = {
  id: string;
  date: string;
  clientName: string;
  address: string;
  postcode?: string | null;
  propertyType?: string | null;
  treatment: string;
  notes?: string;
  rooms?: Array<string | { name: string; note?: string }>;
  baitBoxesPlaced?: string;
  poisonUsed?: string;
  followUpDate?: string;
  photoUrl?: string;
  photoUrls?: string[];
  photos?: { url: string }[];
  signature?: string;
  price?: number;
};

type Certification = {
  id: string;
  fileUrl: string;
  expiryDate?: string | null;
  uploadedAt: string;
  signedUrl?: string;
};

type RoomForm = {
  name: string;
  note: string;
};

function isRenderableImageSrc(value: string): boolean {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('blob:') ||
    value.startsWith('data:') ||
    value.startsWith('/')
  );
}

function parsePhotoUrls(photoUrl?: string, photoUrls?: string[], photos?: { url: string }[]): string[] {
  if (Array.isArray(photos) && photos.length > 0) {
    return photos.map((photo) => photo.url).filter((url) => Boolean(url) && isRenderableImageSrc(url)).slice(0, 4);
  }
  if (Array.isArray(photoUrls) && photoUrls.length > 0) {
    return photoUrls.filter((url) => isRenderableImageSrc(url)).slice(0, 4);
  }
  if (!photoUrl) return [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string' && isRenderableImageSrc(value)).slice(0, 4);
    }
  } catch {
    // Not JSON; treat as single URL.
  }
  return isRenderableImageSrc(photoUrl) ? [photoUrl] : [];
}

function supabaseImageLoader({ src }: { src: string }): string {
  return src;
}

const treatments = [
  'General Pest Control',
  'Emergency Pest Call-out',
  'Rodent Control - Rats',
  'Rodent Control - Mice',
  'Squirrel Control',
  'Rabbit Control',
  'Mole Control',
  'Bed Bug Treatment',
  'Flea Treatment',
  'Cockroach Treatment',
  'Ant Treatment',
  'Wasp Nest Treatment',
  'Hornet Nest Treatment',
  'Fly Control',
  'Cluster Fly Treatment',
  'Moth Treatment',
  'Carpet Beetle Treatment',
  'Silverfish Treatment',
  'Stored Product Insect Treatment',
  'Spider Control',
  'Woodlice Control',
  'Termite Inspection/Treatment',
  'Bird Control - Pigeon Proofing',
  'Bird Control - Gull Deterrent',
  'Bird Mite Treatment',
  'Drain Survey and Treatment',
  'Drain Fly Treatment',
  'Fogging Treatment',
  'ULV Treatment',
  'Heat Treatment',
  'Fumigation Service',
  'Sanitisation/Disinfection',
  'Proofing/Exclusion Work',
  'Follow-up Inspection',
  'Monitoring Visit',
  'Bait Station Service',
  'Audit/Compliance Inspection',
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'residential_house', label: 'Residential — house' },
  { value: 'residential_flat', label: 'Residential — flat / apartment' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'agricultural', label: 'Agricultural / farm' },
  { value: 'other', label: 'Other' },
] as const;

const ENABLE_VOICE_NOTES = process.env.NEXT_PUBLIC_ENABLE_VOICE_NOTES === 'true';
const ENABLE_PHOTO_ANNOTATION = process.env.NEXT_PUBLIC_ENABLE_PHOTO_ANNOTATION === 'true';

/**
 * Per-country configuration for the postcode / ZIP / PIN field.
 * - label:       what the user sees on the form
 * - placeholder: example value shown inside the input
 * - required:    whether the field must be filled before submission
 * - validate:    returns true when the value is acceptable
 */
type PostcodeConfig = {
  label: string;
  placeholder: string;
  required: boolean;
  validate: (value: string) => boolean;
};

const POSTCODE_CONFIG: Record<string, PostcodeConfig> = {
  GB: {
    label: 'Postcode',
    placeholder: 'e.g. SW1A 1AA',
    required: true,
    validate: isValidUkPostcode,
  },
  US: {
    label: 'ZIP Code',
    placeholder: 'e.g. 90210',
    required: false,
    validate: (v) => /^\d{5}(-\d{4})?$/.test(v),
  },
  CA: {
    label: 'Postal Code',
    placeholder: 'e.g. M5V 3L9',
    required: false,
    validate: (v) => /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(v),
  },
  IN: {
    label: 'PIN Code',
    placeholder: 'e.g. 110001',
    required: false,
    validate: (v) => /^\d{6}$/.test(v),
  },
  AU: {
    label: 'Postcode',
    placeholder: 'e.g. 2000',
    required: false,
    validate: (v) => /^\d{4}$/.test(v),
  },
};

const PERMISSIVE_POSTCODE_CONFIG: PostcodeConfig = {
  label: 'Postcode / ZIP',
  placeholder: '',
  required: false,
  validate: () => true,
};

/**
 * Returns the postcode config for the given country.
 *
 * The `confident` flag must come from resolveCountryWithConfidence (via
 * useLocale). When confident is false it means the country was not
 * explicitly detected — only a fallback default. In that case we never
 * apply country-specific mandatory rules, so an undetected user is never
 * blocked by UK postcode requirements.
 */
function getPostcodeConfig(country: string, confident: boolean): PostcodeConfig {
  // Only enforce strict GB rules when we are sure the user is in GB.
  if (country === 'GB' && !confident) {
    return PERMISSIVE_POSTCODE_CONFIG;
  }
  return POSTCODE_CONFIG[country] ?? PERMISSIVE_POSTCODE_CONFIG;
}

function propertyTypeLabel(value: string | null | undefined): string {
  if (!value) return '';
  const hit = PROPERTY_TYPE_OPTIONS.find((o) => o.value === value);
  return hit?.label ?? value;
}

export default function TechnicianPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { country, countryConfident } = useLocale();
  const isPreviewMode = process.env.NODE_ENV === 'development' && router.query.preview === '1';
  const { canSwitchToTechnician } = usePermissions();
  const canReturnToAdminDashboard = canSwitchToTechnician();
  const accessDeniedTarget = typeof router.query.accessDenied === 'string' ? router.query.accessDenied : '';
  const [loading, setLoading] = useState(true);
  const [billingSuspended, setBillingSuspended] = useState(false);
  const [profile, setProfile] = useState<TechnicianProfile | null>(null);
  // Company country from the database takes priority over browser detection.
  // This eliminates mis-detection caused by browser language preferences
  // that don't reflect where the technician is actually located.
  const effectiveCountry = profile?.companyCountry ?? country;
  const effectiveConfident = profile?.companyCountry != null ? true : countryConfident;
  const postcodeConfig = getPostcodeConfig(effectiveCountry, effectiveConfident);
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [visibleEntries, setVisibleEntries] = useState(20);
  const [date, setDate] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [propertyType, setPropertyType] = useState<(typeof PROPERTY_TYPE_OPTIONS)[number]['value']>(
    PROPERTY_TYPE_OPTIONS[0].value,
  );
  const [treatment, setTreatment] = useState(treatments[0]);
  const [notes, setNotes] = useState('');
  const [photoAnnotation, setPhotoAnnotation] = useState('');
  const [rooms, setRooms] = useState<RoomForm[]>([]);
  const [baitBoxesPlaced, setBaitBoxesPlaced] = useState('');
  const [poisonUsed, setPoisonUsed] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; treatment: string; notes: string; poisonUsed: string; baitBoxesPlaced: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [certExpiryDate, setCertExpiryDate] = useState('');
  const [certUploading, setCertUploading] = useState(false);
  const [overdueBanner, setOverdueBanner] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const lastDraftKeyRef = useRef('');

  const addRoom = () => {
    setRooms((prev) => [...prev, { name: '', note: '' }]);
  };

  const updateRoom = (index: number, field: keyof RoomForm, value: string) => {
    setRooms((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeRoom = (index: number) => {
    setRooms((prev) => prev.filter((_, i) => i !== index));
  };

  const currentDraftKey = profile ? `tech-draft:${profile.id}` : '';
  const templateStorageKey = profile ? `tech-templates:${profile.companyId}` : '';

  const getSupabaseToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  useEffect(() => {
    if (loading || !profile) return;
    if (entries.length === 0 && !isTechnicianOnboardingDismissed()) {
      const timeout = window.setTimeout(() => setShowOnboarding(true), 0);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [loading, profile, entries.length]);

  useEffect(() => {
    if (!currentDraftKey) return;
    if (lastDraftKeyRef.current === currentDraftKey) return;
    const raw = localStorage.getItem(currentDraftKey);
    if (!raw) {
      lastDraftKeyRef.current = currentDraftKey;
      return;
    }
    try {
      const draft = JSON.parse(raw) as Record<string, unknown>;
      window.setTimeout(() => {
        if (typeof draft.date === 'string') setDate(draft.date);
        if (typeof draft.clientName === 'string') setClientName(draft.clientName);
        if (typeof draft.address === 'string') setAddress(draft.address);
        if (typeof draft.postcode === 'string') setPostcode(draft.postcode);
        if (typeof draft.propertyType === 'string' && PROPERTY_TYPE_OPTIONS.some((o) => o.value === draft.propertyType)) {
          setPropertyType(draft.propertyType as (typeof PROPERTY_TYPE_OPTIONS)[number]['value']);
        }
        if (typeof draft.treatment === 'string') setTreatment(draft.treatment);
        if (typeof draft.notes === 'string') setNotes(draft.notes);
        if (Array.isArray(draft.rooms)) {
          setRooms(
            draft.rooms.map((item) => ({
              name: typeof (item as { name?: unknown })?.name === 'string' ? (item as { name: string }).name : '',
              note: typeof (item as { note?: unknown })?.note === 'string' ? (item as { note: string }).note : '',
            })),
          );
        }
        if (typeof draft.baitBoxesPlaced === 'string') setBaitBoxesPlaced(draft.baitBoxesPlaced);
        if (typeof draft.poisonUsed === 'string') setPoisonUsed(draft.poisonUsed);
        if (typeof draft.followUpDate === 'string') setFollowUpDate(draft.followUpDate);
        if (typeof draft.photoAnnotation === 'string') setPhotoAnnotation(draft.photoAnnotation);
      }, 0);
    } catch {
      // Ignore invalid draft.
    }
    lastDraftKeyRef.current = currentDraftKey;
  }, [currentDraftKey]);

  useEffect(() => {
    if (!currentDraftKey) return;
    localStorage.setItem(
      currentDraftKey,
      JSON.stringify({
        date,
        clientName,
        address,
        postcode,
        propertyType,
        treatment,
        notes,
        rooms,
        baitBoxesPlaced,
        poisonUsed,
        followUpDate,
        photoAnnotation,
      }),
    );
  }, [currentDraftKey, date, clientName, address, postcode, propertyType, treatment, notes, rooms, baitBoxesPlaced, poisonUsed, followUpDate, photoAnnotation]);

  useEffect(() => {
    if (!templateStorageKey) return;
    const raw = localStorage.getItem(templateStorageKey);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return;
      window.setTimeout(() => {
        setTemplates(
          data.map((item) => ({
            id: typeof item?.id === 'string' ? item.id : `${Date.now()}-${Math.random()}`,
            name: typeof item?.name === 'string' ? item.name : 'Template',
            treatment: typeof item?.treatment === 'string' ? item.treatment : treatments[0],
            notes: typeof item?.notes === 'string' ? item.notes : '',
            poisonUsed: typeof item?.poisonUsed === 'string' ? item.poisonUsed : '',
            baitBoxesPlaced: typeof item?.baitBoxesPlaced === 'string' ? item.baitBoxesPlaced : '',
          })),
        );
      }, 0);
    } catch {
      // Ignore invalid template data.
    }
  }, [templateStorageKey]);

  const saveCurrentTemplate = () => {
    if (!templateStorageKey) return;
    const name = window.prompt('Template name');
    if (!name?.trim()) return;
    const next = [
      {
        id: `${Date.now()}-${Math.random()}`,
        name: name.trim(),
        treatment,
        notes,
        poisonUsed,
        baitBoxesPlaced,
      },
      ...templates,
    ].slice(0, 20);
    setTemplates(next);
    localStorage.setItem(templateStorageKey, JSON.stringify(next));
    showToast('Template saved', `"${name.trim()}" is ready to reuse.`, 'success');
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setTreatment(template.treatment);
    setNotes(template.notes);
    setPoisonUsed(template.poisonUsed);
    setBaitBoxesPlaced(template.baitBoxesPlaced);
    showToast('Template applied', `Loaded "${template.name}".`, 'success');
  };

  const startVoiceNoteCapture = () => {
    type WebkitSpeechRecognitionCtor = new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      start: () => void;
    };
    const SpeechRecognitionApi = (window as Window & { webkitSpeechRecognition?: WebkitSpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!SpeechRecognitionApi) {
      showToast('Voice notes unavailable', 'This browser does not support voice recognition.', 'info');
      return;
    }
    const recognition = new SpeechRecognitionApi();
    recognition.lang = 'en-GB';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (!transcript) return;
      setNotes((prev) => (prev ? `${prev}\n${transcript}` : transcript));
      showToast('Voice note added', 'Transcript appended to notes.', 'success');
    };
    recognition.onerror = () => {
      showToast('Voice note failed', 'Unable to capture voice note.', 'error');
    };
    recognition.start();
  };

  useEffect(() => {
    if (!router.isReady) return;
    const loadProfile = async () => {
      if (isPreviewMode) {
        setProfile({
          id: 'preview-tech',
          name: 'John Smith',
          email: 'john@preview.local',
          companyId: 'preview-company',
          companyName: 'Pest Trace Preview Co.',
          companyCountry: null,
        });
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        return;
      }

      const res = await fetch('/api/technician-profile', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.technician) {
        router.push('/dashboard');
        return;
      }

      setProfile(result.technician);

      const subRes = await fetch('/api/subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        const accessSnapshot = {
          plan: subData.plan,
          subscriptionStatus: subData.status,
          trialEndsAt: subData.trialEndsAt,
          paymentGraceEndsAt: subData.paymentGraceEndsAt,
          paymentFailedAt: subData.paymentFailedAt,
        };
        const hasAccess = hasSubscriptionAccess(accessSnapshot);
        if (!hasAccess) {
          if (hasOutstandingPaymentFailure(accessSnapshot)) {
            setBillingSuspended(true);
            setLoading(false);
            return;
          }
          router.replace('/upgrade');
          return;
        }
        setBillingSuspended(false);
        const daysLeft = getGraceDaysLeft(accessSnapshot);
        setOverdueBanner(
          daysLeft !== null
            ? `Billing is overdue. Your company has ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining before service interruption.`
            : null
        );
      }

      setLoading(false);
    };

    loadProfile();
  }, [isPreviewMode, router, router.isReady]);

  useEffect(() => {
    const loadEntries = async () => {
      if (isPreviewMode) {
        setEntries([
          {
            id: 'preview-1',
            date: new Date().toISOString(),
            clientName: 'Riverside Restaurant',
            address: '45 High Street, Manchester',
            postcode: 'M1 1AE',
            propertyType: 'commercial',
            treatment: 'Rodenticide Bait Stations',
            notes: 'Installed 6 bait stations in kitchen and storage areas.',
          rooms: ['Kitchen', 'Storage'],
          baitBoxesPlaced: '6',
          poisonUsed: 'Rodenticide bait blocks',
          followUpDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          },
          {
            id: 'preview-2',
            date: new Date(Date.now() - 86400000).toISOString(),
            clientName: 'City Warehouse Ltd',
            address: '12 Industrial Estate, Leeds',
            postcode: 'LS1 4DY',
            propertyType: 'commercial',
            treatment: 'Rodent Monitoring',
            notes: 'Quarterly inspection completed. No activity detected.',
          rooms: ['Warehouse floor'],
          },
        ]);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/technician-logbook', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const result = await res.json();
      setEntries(result);
    };

    if (profile) {
      loadEntries();
    }
  }, [isPreviewMode, profile]);

  useEffect(() => {
    const loadCertifications = async () => {
      if (!profile) return;

      if (isPreviewMode) {
        setCertifications([
          {
            id: 'preview-cert-1',
            fileUrl: '/icon-192.png',
            uploadedAt: new Date().toISOString(),
            expiryDate: new Date(Date.now() + 31536000000).toISOString(),
            signedUrl: '/icon-192.png',
          },
        ]);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/technicians/${profile.id}/certifications`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;

      const data = (await res.json()) as Certification[];
      const signed = await Promise.all(
        data.map(async (cert) => {
          const { data: signedData } = await supabase.storage
            .from('logbook-photos')
            .createSignedUrl(cert.fileUrl, 3600);
          return {
            ...cert,
            signedUrl: signedData?.signedUrl || cert.fileUrl,
          };
        }),
      );
      setCertifications(signed);
    };

    void loadCertifications();
  }, [isPreviewMode, profile]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl('');
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    ctx.strokeStyle = '#1E293B';
    const strokeW = event.pointerType === 'touch' || event.pointerType === 'pen' ? 3.75 : 2.25;
    ctx.lineWidth = strokeW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Calculate scale factor between display size and internal canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Scale coordinates to match internal canvas size
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();

    // Calculate scale factor between display size and internal canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Scale coordinates to match internal canvas size
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1E293B';
    const strokeW = event.pointerType === 'touch' || event.pointerType === 'pen' ? 3.75 : 2.25;
    ctx.lineWidth = strokeW;
    ctx.stroke();
    event.preventDefault();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    setSignatureDataUrl(canvas.toDataURL('image/png'));
    event.preventDefault();
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    setSignatureDataUrl(canvas.toDataURL('image/png'));
    event.preventDefault();
  };

  const handlePhotoChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selectedFiles = Array.from(files).slice(0, 4);
    const previewUrls = selectedFiles.map((file) => URL.createObjectURL(file));
    setPhotoPreviewUrls(previewUrls);

    if (isPreviewMode) {
      setPhotoUrls(previewUrls);
      showToast('Preview mode', 'Using local preview image only.', 'info');
      return;
    }

    if (!profile) return;
    setPhotoUploading(true);
    const uploadResults = await Promise.all(
      selectedFiles.map(async (file, index) => {
        const sanitizedFileName = file.name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-._]/g, '');
        const filePath = `${profile.companyId}/${profile.id}/${Date.now()}-${index}-${sanitizedFileName}`;
        const { error: uploadError } = await supabase.storage
          .from('logbook-photos')
          .upload(filePath, file, {
            cacheControl: '3600',
            contentType: file.type,
            upsert: false,
          });
        return { filePath, uploadError };
      }),
    );

    const failedUpload = uploadResults.find((result) => result.uploadError);
    if (failedUpload?.uploadError) {
      showToast('Photo upload failed', failedUpload.uploadError.message, 'error');
      console.error('Photo upload failed:', failedUpload.uploadError);
      setPhotoUploading(false);
      return;
    }

    setPhotoUrls(uploadResults.map((result) => result.filePath));
    setPhotoUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const pc = postcode.trim();

    if (postcodeConfig.required && !pc) {
      showToast(`Missing ${postcodeConfig.label}`, `${postcodeConfig.label} is required for every logbook entry.`, 'error');
      return;
    }

    if (pc && !postcodeConfig.validate(pc)) {
      showToast(`Invalid ${postcodeConfig.label}`, `Please enter a valid ${postcodeConfig.label}.`, 'error');
      return;
    }

    setSubmitting(true);
    const finalNotes =
      ENABLE_PHOTO_ANNOTATION && photoAnnotation.trim()
        ? `${notes}${notes ? '\n' : ''}[Photo note] ${photoAnnotation.trim()}`
        : notes;

    if (isPreviewMode) {
      setEntries((prev) => [
        {
          id: `preview-${Date.now()}`,
          date: date || new Date().toISOString(),
          clientName,
          address,
          postcode: pc,
          propertyType,
          treatment,
          notes: finalNotes,
          rooms: rooms
            .map((room) => room.name.trim())
            .filter((room) => room.length > 0),
          baitBoxesPlaced,
          poisonUsed,
          followUpDate: followUpDate || undefined,
          photoUrl: photoUrls[0],
          photoUrls,
          signature: signatureDataUrl,
        },
        ...prev,
      ]);
      setDate('');
      setClientName('');
      setAddress('');
      setPostcode('');
      setPropertyType(PROPERTY_TYPE_OPTIONS[0].value);
      setTreatment(treatments[0]);
      setNotes('');
      setRooms([]);
      setBaitBoxesPlaced('');
      setPoisonUsed('');
      setFollowUpDate('');
      setPhotoUrls([]);
      setPhotoPreviewUrls([]);
      setPhotoAnnotation('');
      clearSignature();
      if (currentDraftKey) localStorage.removeItem(currentDraftKey);
      showToast('Preview mode', 'Entry saved locally in preview mode.', 'success');
      setSubmitting(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSubmitting(false);
      router.push('/auth/signin');
      return;
    }

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticEntry: LogbookEntry = {
      id: optimisticId,
      date: date || new Date().toISOString(),
      clientName,
      address,
      postcode: pc,
      propertyType,
      treatment,
      notes: finalNotes,
      rooms: rooms
        .map((room) => room.name.trim())
        .filter((room) => room.length > 0),
      baitBoxesPlaced,
      poisonUsed,
      followUpDate: followUpDate || undefined,
      photoUrl: photoUrls[0],
      photoUrls,
      signature: signatureDataUrl,
    };
    setEntries((prev) => [optimisticEntry, ...prev]);

    const res = await fetch('/api/technician-logbook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        date,
        clientName,
        address,
        postcode: pc,
        propertyType,
        treatment,
        notes: finalNotes,
        rooms: rooms
          .map((room) => room.name.trim())
          .filter((room) => room.length > 0),
        baitBoxesPlaced,
        poisonUsed,
        followUpDate: followUpDate || undefined,
        photoUrl: photoUrls[0],
        photoUrls,
        signature: signatureDataUrl,
      }),
    });

    if (res.ok) {
      const entry = await res.json();
      setEntries((prev) => [entry, ...prev.filter((item) => item.id !== optimisticId)]);
      setDate('');
      setClientName('');
      setAddress('');
      setPostcode('');
      setPropertyType(PROPERTY_TYPE_OPTIONS[0].value);
      setTreatment(treatments[0]);
      setNotes('');
      setRooms([]);
      setBaitBoxesPlaced('');
      setPoisonUsed('');
      setFollowUpDate('');
      setPhotoUrls([]);
      setPhotoPreviewUrls([]);
      setPhotoAnnotation('');
      clearSignature();
      if (currentDraftKey) localStorage.removeItem(currentDraftKey);
    } else {
      setEntries((prev) => prev.filter((item) => item.id !== optimisticId));
      const err = await res.json().catch(() => ({ error: 'Could not save entry' }));
      const message = err.details ? `${err.error || 'Could not save entry'}: ${err.details}` : (err.error || 'Could not save entry');
      console.error('Technician logbook save failed', err);
      showToast('Save failed', message, 'error');
    }

    setSubmitting(false);
  };

  const handleCertificateUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !profile) return;

    const file = files[0];
    if (isPreviewMode) {
      setCertifications((prev) => [
        {
          id: `preview-cert-${Date.now()}`,
          fileUrl: '/icon-192.png',
          signedUrl: '/icon-192.png',
          expiryDate: certExpiryDate || null,
          uploadedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setCertExpiryDate('');
      showToast('Preview mode', 'Certification stored locally in preview mode.', 'success');
      return;
    }

    setCertUploading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setCertUploading(false);
      router.push('/auth/signin');
      return;
    }

    const sanitizedFileName = file.name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-._]/g, '');
    const filePath = `${profile.id}/cert-${Date.now()}-${sanitizedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('logbook-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      showToast('Upload failed', uploadError.message, 'error');
      setCertUploading(false);
      return;
    }

    const certRes = await fetch('/api/technicians/certifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        technicianId: profile.id,
        fileUrl: filePath,
        expiryDate: certExpiryDate || undefined,
      }),
    });

    if (!certRes.ok) {
      const err = await certRes.json().catch(() => ({ error: 'Unable to save certification' }));
      showToast('Upload failed', err.error || 'Unable to save certification', 'error');
      setCertUploading(false);
      return;
    }

    const refreshRes = await fetch(`/api/technicians/${profile.id}/certifications`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (refreshRes.ok) {
      const data = (await refreshRes.json()) as Certification[];
      const signed = await Promise.all(
        data.map(async (cert) => {
          const { data: signedData } = await supabase.storage
            .from('logbook-photos')
            .createSignedUrl(cert.fileUrl, 3600);
          return {
            ...cert,
            signedUrl: signedData?.signedUrl || cert.fileUrl,
          };
        }),
      );
      setCertifications(signed);
    }

    setCertExpiryDate('');
    setCertUploading(false);
    showToast('Uploaded', 'Certification uploaded successfully.', 'success');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-offwhite">Loading technician dashboard...</div>;
  }

  if (billingSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-offwhite px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-md">
          <h1 className="text-xl font-bold text-navy">Company access suspended</h1>
          <p className="mt-3 text-sm text-gray-600">
            Your company&apos;s subscription payment failed. Ask the account owner to update their card in Stripe billing
            before you can use Pest Trace again.
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center bg-offwhite">Access denied.</div>;
  }

  const followUpCount = entries.filter((entry) => Boolean(entry.followUpDate)).length;
  const photoCoverageCount = entries.filter((entry) => parsePhotoUrls(entry.photoUrl, entry.photoUrls, entry.photos).length > 0).length;

  return (
    <div className="min-h-screen overflow-x-hidden bg-offwhite">
      <div className="flex min-w-0">
        <Sidebar role="technician" activeTab="logbook" onSignOut={async () => {
          if (isPreviewMode) {
            router.push('/auth/signin');
            return;
          }
          await supabase.auth.signOut();
          router.push('/auth/signin');
        }} />
        <div className="min-w-0 flex-1 px-4 pb-6 pt-20 sm:px-6 sm:pb-8 sm:pt-24 lg:px-8">
      <div className="min-w-0 max-w-5xl space-y-6">
        {accessDeniedTarget ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Access to owner-only {accessDeniedTarget === 'upgrade' ? 'billing/upgrade' : 'dashboard'} sections is restricted for technician accounts.
          </div>
        ) : null}
        {overdueBanner ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {overdueBanner}
          </div>
        ) : null}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-navy mb-3">Technician Logbook</h1>
            <div className="mx-auto h-1 w-16 bg-primary-500 rounded-full mb-4"></div>
            <p className="text-sm text-gray-600">Signed in as {profile.name} ({profile.email})</p>
            <p className="text-sm text-gray-500">Company: {profile.companyName}</p>
            {canReturnToAdminDashboard ? (
              <div className="mt-4">
                <Link
                  href="/dashboard"
                  data-testid="back-to-admin-dashboard-link"
                  className="inline-flex items-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Back to admin dashboard
                </Link>
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Logged Jobs</p>
              <p className="mt-1 text-base font-semibold text-emerald-900">{entries.length}</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Follow-ups</p>
              <p className="mt-1 text-base font-semibold text-amber-900">{followUpCount}</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-blue-700">Jobs With Photos</p>
              <p className="mt-1 text-base font-semibold text-blue-900">{photoCoverageCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 sm:p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy mb-3">Add New Entry</h2>
            <div className="mx-auto h-1 w-16 bg-primary-500 rounded-full"></div>
          </div>
          <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Quick guide: fill required fields, add optional rooms/photos/signature, then save. If you are offline, entries are queued and synced automatically once online.
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date and Client Name Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="form-group">
                <label htmlFor="technician-entry-date" className="form-label">Date <span className="text-red-500">*</span></label>
                <input
                  id="technician-entry-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="technician-entry-client" className="form-label">Client Name <span className="text-red-500">*</span></label>
                <input
                  id="technician-entry-client"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                  placeholder="Client name"
                  className="form-input"
                />
              </div>
            </div>

            {/* Address Row */}
            <div className="form-group">
              <label htmlFor="technician-entry-address" className="form-label">Address <span className="text-red-500">*</span></label>
              <input
                id="technician-entry-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                placeholder="Job address"
                className="form-input"
              />
            </div>

            {/* Postcode / ZIP / PIN — label and validation adapt to the technician's country */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="form-group">
                <label htmlFor="technician-entry-postcode" className="form-label">
                  {postcodeConfig.label}
                  {postcodeConfig.required && <span className="text-red-500"> *</span>}
                </label>
                <input
                  id="technician-entry-postcode"
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  required={postcodeConfig.required}
                  autoComplete="postal-code"
                  placeholder={postcodeConfig.placeholder}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="technician-entry-property-type" className="form-label">
                  Property type <span className="text-red-500">*</span>
                </label>
                <select
                  id="technician-entry-property-type"
                  value={propertyType}
                  onChange={(e) =>
                    setPropertyType(e.target.value as (typeof PROPERTY_TYPE_OPTIONS)[number]['value'])
                  }
                  required
                  className="form-select"
                >
                  {PROPERTY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Treatment and Photo Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="form-group">
                <label htmlFor="technician-entry-treatment" className="form-label">Treatment <span className="text-red-500">*</span></label>
                <select
                  id="technician-entry-treatment"
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  required
                  className="form-select"
                >
                  {treatments.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={saveCurrentTemplate} className="btn btn-secondary btn-sm">
                    Save Template
                  </button>
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => applyTemplate(event.target.value)}
                    className="form-select !min-h-[2.25rem] !py-1 !px-2 text-sm"
                  >
                    <option value="">Apply Template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="technician-entry-photo" className="form-label">Optional Photos (up to 4)</label>
                <input
                  id="technician-entry-photo"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => void handlePhotoChange(e.target.files)}
                  className="form-input"
                />
                {photoUploading && (
                  <p className="mt-2 text-sm text-blue-600 flex items-center gap-1">
                    <span className="spinner-dark"></span> Uploading photo...
                  </p>
                )}
                {photoPreviewUrls.length > 0 && !photoUploading && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-green-600">✓ {photoPreviewUrls.length} photo(s) uploaded successfully.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {photoPreviewUrls.map((url) => (
                        <Image key={url} src={url} alt="Uploaded job photo preview" width={400} height={200} className="h-24 w-full rounded-lg border object-cover" unoptimized />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rooms and Follow-up */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="form-group">
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Rooms Worked In</label>
                  <button
                    type="button"
                    onClick={addRoom}
                    className="text-sm font-medium text-primary-700 hover:text-primary-800"
                  >
                    + Add room
                  </button>
                </div>
                {rooms.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">
                    No rooms added yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rooms.map((room, index) => (
                      <div key={`${index}-${room.name}`} className="rounded-lg border border-gray-200 p-3">
                        <input
                          type="text"
                          value={room.name}
                          onChange={(e) => updateRoom(index, 'name', e.target.value)}
                          placeholder="Room name (e.g. Kitchen)"
                          className="form-input mb-2"
                        />
                        <input
                          type="text"
                          value={room.note}
                          onChange={(e) => updateRoom(index, 'note', e.target.value)}
                          placeholder="Optional room note"
                          className="form-input"
                        />
                        <button
                          type="button"
                          onClick={() => removeRoom(index)}
                          className="mt-2 text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Remove room
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="technician-entry-followup" className="form-label">Follow-up Date (optional)</label>
                <input
                  id="technician-entry-followup"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="form-group">
                <label htmlFor="technician-entry-bait" className="form-label">Bait Boxes Placed</label>
                <input
                  id="technician-entry-bait"
                  type="text"
                  value={baitBoxesPlaced}
                  onChange={(e) => setBaitBoxesPlaced(e.target.value)}
                  placeholder="e.g. 6"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="technician-entry-poison" className="form-label">Poison Used</label>
                <input
                  id="technician-entry-poison"
                  type="text"
                  value={poisonUsed}
                  onChange={(e) => setPoisonUsed(e.target.value)}
                  placeholder="e.g. Bromadiolone blocks"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="technician-entry-notes" className="form-label">Additional Notes</label>
              <textarea
                id="technician-entry-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Enter treatment substances, observations, and any notes about the job..."
                className="form-textarea"
              />
              {ENABLE_VOICE_NOTES ? (
                <button type="button" onClick={startVoiceNoteCapture} className="mt-2 btn btn-secondary btn-sm">
                  Add Voice Note
                </button>
              ) : null}
            </div>

            {ENABLE_PHOTO_ANNOTATION ? (
              <div className="form-group">
                <label htmlFor="technician-photo-annotation" className="form-label">Photo Annotation</label>
                <textarea
                  id="technician-photo-annotation"
                  value={photoAnnotation}
                  onChange={(e) => setPhotoAnnotation(e.target.value)}
                  rows={2}
                  placeholder="Optional context for uploaded photos."
                  className="form-textarea"
                />
              </div>
            ) : null}

            {/* Signature Canvas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">E-Signature</label>
                {signatureDataUrl && (
                  <button 
                    type="button" 
                    onClick={clearSignature} 
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Clear Signature
                  </button>
                )}
              </div>
              <div className="rounded-lg border-2 border-gray-300 overflow-hidden bg-white shadow-sm touch-none">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={200}
                  className="signature-canvas w-full max-h-[200px]"
                  style={{ touchAction: 'none' }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerCancel}
                  onPointerCancel={handlePointerCancel}
                />
              </div>
              <p className="mt-2 text-xs sm:text-sm text-gray-500">👆 Use your finger or mouse to draw your signature above</p>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-lg hover-lift"
              >
                {submitting ? (
                  <>
                    <span className="spinner"></span>
                    <span>Saving entry...</span>
                  </>
                ) : (
                  '✓ Save Entry'
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy mb-3">My Certifications</h2>
            <div className="mx-auto h-1 w-16 bg-primary-500 rounded-full"></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tech-cert-expiry" className="form-label">Expiry Date (optional)</label>
              <input
                id="tech-cert-expiry"
                type="date"
                value={certExpiryDate}
                onChange={(e) => setCertExpiryDate(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="tech-cert-file" className="form-label">Upload Certificate</label>
              <input
                id="tech-cert-file"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => void handleCertificateUpload(e.target.files)}
                className="form-input"
              />
              {certUploading ? <p className="mt-2 text-sm text-blue-600">Uploading certification...</p> : null}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {certifications.map((cert) => (
              <div key={cert.id} className="rounded-lg border border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Uploaded {new Date(cert.uploadedAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {cert.expiryDate ? `Expires ${new Date(cert.expiryDate).toLocaleDateString()}` : 'No expiry date set'}
                  </p>
                </div>
                <a
                  href={cert.signedUrl || cert.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  View certificate
                </a>
              </div>
            ))}
            {certifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500 text-center">
                No certifications uploaded yet.
              </div>
            ) : null}
          </div>
        </div>

        <details className="rounded-2xl border border-gray-200 bg-white shadow-md" open>
          <summary className="cursor-pointer list-none rounded-2xl px-6 py-4 transition hover:bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Saved log entries</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{entries.length} logs</span>
            </div>
          </summary>
          <div className="max-h-[70vh] overflow-y-auto px-5 pb-5">
            <div className="space-y-4">
              {entries.slice(0, visibleEntries).map((entry) => {
                const photoUrls = parsePhotoUrls(entry.photoUrl, entry.photoUrls, entry.photos);
                return (
                <details key={entry.id} className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4" open={false}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-navy">{entry.clientName}</h3>
                        <p className="text-sm text-gray-500">{new Date(entry.date).toLocaleDateString()}</p>
                      </div>
                      <span className="inline-flex max-w-full break-words rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">{entry.treatment}</span>
                    </div>
                  </summary>
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <p className="text-gray-700">{entry.address}</p>
                    {entry.postcode ? (
                      <p className="mt-1 text-sm text-gray-600">Postcode: {entry.postcode}</p>
                    ) : null}
                    {entry.propertyType ? (
                      <p className="mt-0.5 text-sm text-gray-600">Property: {propertyTypeLabel(entry.propertyType)}</p>
                    ) : null}
                    {entry.rooms && entry.rooms.length > 0 ? (
                      <p className="mt-2 text-sm text-gray-600">
                        Rooms: {entry.rooms.map((room) => (typeof room === 'string' ? room : room.name)).join(', ')}
                      </p>
                    ) : null}
                    {entry.followUpDate ? (
                      <p className="mt-1 text-sm font-medium text-amber-700">
                        Follow-up: {new Date(entry.followUpDate).toLocaleDateString()}
                      </p>
                    ) : null}
                    {entry.baitBoxesPlaced ? <p className="mt-1 text-sm text-gray-600">Bait boxes: {entry.baitBoxesPlaced}</p> : null}
                    {entry.poisonUsed ? <p className="mt-1 text-sm text-gray-600">Poison used: {entry.poisonUsed}</p> : null}
                    {entry.notes && <p className="mt-2 whitespace-pre-line text-gray-600">{entry.notes}</p>}
                    {photoUrls.length > 0 ? (
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {photoUrls.map((url) => (
                          <Image
                            key={url}
                            loader={supabaseImageLoader}
                            src={url}
                            alt="Logged job photo"
                            width={800}
                            height={400}
                            className="max-h-52 w-full rounded-2xl border border-gray-200 object-cover"
                            unoptimized
                          />
                        ))}
                      </div>
                    ) : null}
                    {entry.signature && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm text-gray-500">Signature</p>
                        <Image
                          src={entry.signature}
                          alt="Job signature"
                          width={1200}
                          height={400}
                          className="max-h-40 w-full rounded-2xl border border-gray-200 object-contain"
                          unoptimized
                        />
                      </div>
                    )}
                  </div>
                </details>
              )})}

              {entries.length > visibleEntries ? (
                <div className="flex justify-center pt-2">
                  <Button type="button" variant="secondary" onClick={() => setVisibleEntries((prev) => prev + 20)}>
                    Load more logs
                  </Button>
                </div>
              ) : null}

              {entries.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-600">
                  No logbook entries yet. Add the first entry above.
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
        </div>
      </div>
      <OnboardingModal
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        getSupabaseToken={getSupabaseToken}
      />
    </div>
  );
}
