import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customerApi, deliveryNoteApi, settingsApi } from '../../api';
import { formatCurrency } from '../../utils/format.js';
import STANDARD_PARTICULARS, { DEFAULT_SHEET_SIZE_OPTIONS } from '../../data/standardParticulars.js';
import { highestParticularNumber } from '../../utils/particularsNumbering.js';
import { computeItemAmount } from '../../utils/itemAmount.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import BackButton from '../common/BackButton.jsx';
import {
  sanitizePhoneInput,
  isValidPhone,
  PHONE_HELP,
  sanitizeVehicleInput,
  isValidVehicleNumber,
  isVehicleNumberProvided,
  VEHICLE_HELP,
  VEHICLE_REQUIRED_HELP,
} from '../../utils/validators.js';

// Item 3 (round 4): a stable per-row identifier, independent of the row's
// position in the array. Previously the table used the row's array INDEX
// as its React key - harmless while only typing values, but the moment a
// custom row is removed from the middle of the list, every row after it
// shifts index, and React (matching by that now-reassigned index key) can
// reattach the wrong row's typed input state to the DOM node that used to
// belong to a different row, visually swapping/losing values that were
// never actually cleared. A monotonically increasing counter, stamped once
// per row at creation time and never recomputed, avoids that entirely.
let rowKeySeq = 0;
const nextRowKey = () => {
  rowKeySeq += 1;
  return `row-${rowKeySeq}`;
};

const emptyItem = () => ({
  _rowKey: nextRowKey(),
  itemName: '',
  quantity: '',
  rate: '',
  custom: true,
  extra: {},
  perDayRate: '',
  monthlyRate: '',
  dateTaken: '',
  dateReturned: '',
  selectedVariant: '',
});

// Picks the display text for a particular row according to the current UI
// language: English shows `labelEn` (falling back to `label` if a row was
// created before labelEn existed), Tamil always shows `label`.
const particularText = (p, language) => {
  if (language === 'en') return p.labelEn && p.labelEn.trim() ? p.labelEn : p.label;
  return p.label;
};

// Pre-fills the item rows with the pad's fixed "Particulars" list (blank qty/rate),
// exactly like the pre-printed paper form - staff only fill in the rows that apply.
// The list itself comes from the database (editable in the Superadmin panel);
// STANDARD_PARTICULARS is only used as an offline fallback if that request fails.
const standardRows = (particulars, language) =>
  particulars.map((p) => ({
    _rowKey: nextRowKey(),
    itemName: particularText(p, language),
    quantity: '',
    rate: p.defaultRate || '',
    custom: false,
    no: p.no,
    particularId: p._id || null,
    extra: {},
    perDayRate: p.defaultPerDayRate || '',
    monthlyRate: p.defaultMonthlyRate || '',
    dateTaken: '',
    dateReturned: '',
    selectedVariant: '',
  }));

// When re-opening a saved note for edit, match each saved line item back to its
// fixed Particulars row by stable particularId first (survives any later
// reordering/renaming in the Superadmin Panel), falling back to matching by
// itemName for notes saved before particularId existed. Only if neither match
// is found is a row treated as a genuine custom/one-off item. This is what
// keeps data typed against row 9 or row 10 reliably reappearing under that
// same row number - never guessed from array position.
const matchSavedItemToParticular = (savedItem, particulars) => {
  if (savedItem.particularId) {
    const byId = particulars.find((p) => String(p._id) === String(savedItem.particularId));
    if (byId) return byId;
  }
  const byName = particulars.find((p) => p.label === savedItem.itemName);
  if (byName) return byName;
  return null;
};

// Pulls a best-guess Name and Address out of raw Aadhaar OCR text. This is
// necessarily approximate (OCR quality on a photographed card varies a lot),
// which is why the caller always leaves the result editable rather than
// auto-submitting it - see the "Scan Aadhaar" button below.
function extractAadhaarFields(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const dateOrDobIdx = lines.findIndex((l) => /(dob|year of birth|\d{2}[\/\-]\d{2}[\/\-]\d{4})/i.test(l));
  let name = '';
  if (dateOrDobIdx > 0) {
    // The name line is typically the one right before the DOB/date line and
    // looks like a name (letters/spaces only, no digits).
    for (let i = dateOrDobIdx - 1; i >= 0 && i >= dateOrDobIdx - 3; i--) {
      const candidate = lines[i];
      if (/^[A-Za-z\s.]{3,50}$/.test(candidate) && !/government|india|male|female/i.test(candidate)) {
        name = candidate;
        break;
      }
    }
  }

  let address = '';
  // Real cards very often print the address label mid-line - "S/O: Foo,
  // Address: 12 Bar Street" all on one line (and Tesseract's own line
  // segmentation frequently merges adjacent short lines too) - so this must
  // find "address" ANYWHERE in a line, not just when it's the first word.
  // Matching only `^address` was the actual bug behind addresses not
  // auto-filling: it silently missed this extremely common layout.
  const addressIdx = lines.findIndex((l) => /address[:\s]/i.test(l));
  if (addressIdx !== -1) {
    const afterColon = lines[addressIdx].replace(/^.*?address[:\s]*/i, '').trim();
    const rest = [];
    for (let i = addressIdx + 1; i < lines.length; i++) {
      if (/^\d{4}\s?\d{4}\s?\d{4}$/.test(lines[i]) || /^www\./i.test(lines[i])) break; // Aadhaar number / website line ends the address block
      rest.push(lines[i]);
      if (/\b\d{6}\b/.test(lines[i])) break; // stop after the PIN code line
    }
    address = [afterColon, ...rest].filter(Boolean).join(', ');
  }

  let phone = '';
  // Aadhaar cards don't reliably print a phone number at all (it's optional/
  // linked separately), but when one is present it's a plain 10-digit
  // Indian mobile number, sometimes with a +91 prefix - same shape the rest
  // of the app already validates against (see Customer.js's phone regex).
  // Known limitation: if OCR reads the 12-digit Aadhaar number itself as one
  // unbroken run (normally it's printed as three space-separated groups of
  // 4, which this regex's trailing \b already guards against), the last 10
  // digits of that run could theoretically false-match as a "phone number"
  // if they happen to start with 6-9. Accepted as a best-effort heuristic,
  // same as the existing name/address extraction above - the person can
  // always correct the field manually, same as if OCR guessed a name wrong.
  const phoneMatch = rawText.match(/(?:\+?91[\-\s]?)?([6-9]\d{9})\b/);
  if (phoneMatch) {
    phone = phoneMatch[1];
  }

  return { name, address, phone };
}

// Phone-camera photos commonly come in at 3000-4000px+ on the long edge,
// which makes Tesseract dramatically slower (and, on weaker mobile CPUs,
// prone to feeling "stuck") for no accuracy benefit beyond a point - Aadhaar
// text doesn't need 12-megapixel resolution to read. Downscaling to a
// reasonable max dimension before OCR keeps scan time predictable.
const OCR_MAX_DIMENSION = 1800;

function downscaleImageForOcr(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, OCR_MAX_DIMENSION / Math.max(img.width, img.height));
      if (scale === 1) {
        resolve(file);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the image'))),
        'image/jpeg',
        0.9
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read the selected image'));
    };
    img.src = objectUrl;
  });
}

// Same matching rule as matchSavedItemToParticular, used at render time to
// find a row's variants (if any) so the variant <select> only shows up next
// to rows that actually have some.
const findParticularForRow = (row, particulars) => {
  if (row.particularId) {
    const byId = particulars.find((p) => String(p._id) === String(row.particularId));
    if (byId) return byId;
  }
  return particulars.find((p) => p.no === row.no) || null;
};

export default function DeliveryNoteForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });
  const [useNewCustomer, setUseNewCustomer] = useState(true);
  const [vehicleNumber, setVehicleNumber] = useState('');
  // Vehicle photo: vehiclePhotoUrl is what's already saved on the server (null
  // until one is uploaded); vehiclePhotoFile is a newly picked file waiting to
  // be uploaded; photoPreview is whichever of those should currently be shown.
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState(null);
  const [vehiclePhotoFile, setVehiclePhotoFile] = useState(null);
  const [vehiclePhotoFilePreview, setVehiclePhotoFilePreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoUploadedNotice, setPhotoUploadedNotice] = useState('');
  const photoInputRef = useRef(null);
  // Second ("receiver") photo - identical shape/flow to the vehicle photo above.
  const [receiverPhotoUrl, setReceiverPhotoUrl] = useState(null);
  const [receiverPhotoFile, setReceiverPhotoFile] = useState(null);
  const [receiverPhotoFilePreview, setReceiverPhotoFilePreview] = useState(null);
  const [receiverPhotoUploading, setReceiverPhotoUploading] = useState(false);
  const [receiverPhotoError, setReceiverPhotoError] = useState('');
  const [receiverPhotoUploadedNotice, setReceiverPhotoUploadedNotice] = useState('');
  const receiverPhotoInputRef = useRef(null);
  const [scanningAadhaar, setScanningAadhaar] = useState(false);
  const [aadhaarError, setAadhaarError] = useState('');
  const aadhaarInputRef = useRef(null);
  const [particulars, setParticulars] = useState(STANDARD_PARTICULARS);
  // Shared size list a particular can opt into via variantSizeSource (e.g.
  // Column Box and Sheets both showing the exact same sizes) - see
  // resolveVariantOptions below for how this and a particular's own
  // `variants` (label -> rate lookup) combine.
  const [sheetSizeOptions, setSheetSizeOptions] = useState(DEFAULT_SHEET_SIZE_OPTIONS);
  const [itemColumns, setItemColumns] = useState([]);
  const [items, setItems] = useState(() => standardRows(STANDARD_PARTICULARS, language));
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [upiRefNumber, setUpiRefNumber] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [extraItemName, setExtraItemName] = useState('');
  const [extraPerDayRate, setExtraPerDayRate] = useState('');
  const [extraMonthlyRate, setExtraMonthlyRate] = useState('');
  const [extraDate, setExtraDate] = useState('');
  const [extraMonth, setExtraMonth] = useState('');
  // Guards against a slow settingsApi.get() response (e.g. Render's
  // free-tier backend waking from cold-start sleep, which can take 30-60s)
  // silently overwriting whatever the person has already typed into the
  // items table while that request was still pending - see the useEffect
  // below that calls setItems(standardRows(...)) once the response arrives.
  const itemsTouchedRef = useRef(false);

  useEffect(() => {
    customerApi.list().then((res) => setCustomers(res.data));
  }, []);

  // Build a preview URL for a newly-picked (not-yet-uploaded) photo file, and
  // clean it up whenever the file changes or the form unmounts - object URLs
  // otherwise leak memory for as long as the page stays open.
  useEffect(() => {
    if (!vehiclePhotoFile) {
      setVehiclePhotoFilePreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(vehiclePhotoFile);
    setVehiclePhotoFilePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [vehiclePhotoFile]);

  useEffect(() => {
    if (!receiverPhotoFile) {
      setReceiverPhotoFilePreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(receiverPhotoFile);
    setReceiverPhotoFilePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [receiverPhotoFile]);

  // Extra item columns (Discount, etc.) apply regardless of create/edit, so this
  // fetch runs either way - only the *prefilled row list* below is create-only.
  useEffect(() => {
    settingsApi
      .get()
      .then((res) => setItemColumns(res.data.itemColumns || []))
      .catch(() => {
        /* no extra columns available offline - form still works without them */
      });
  }, []);

  useEffect(() => {
    // Particulars are needed whether creating or editing: creating uses them to
    // prefill the standard rows, editing uses them to re-match each saved line
    // item back to its correct fixed row (see matchSavedItemToParticular above).
    settingsApi
      .get()
      .then((res) => {
        if (res.data.particulars?.length) {
          setParticulars(res.data.particulars);
          // Only apply the freshly-fetched standard rows if the person
          // hasn't already started typing into the table while this
          // request was in flight - otherwise a slow response (e.g. a
          // cold-starting backend) would silently wipe their input the
          // moment it finally arrives.
          if (!isEdit && !itemsTouchedRef.current) setItems(standardRows(res.data.particulars, language));
        }
        if (res.data.sheetSizeOptions?.length) setSheetSizeOptions(res.data.sheetSizeOptions);
      })
      .catch(() => {
        /* keep the offline fallback list already in state */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  // Re-translate the standard (non-custom) rows' displayed itemName whenever the
  // language toggle changes, without touching whatever the staff has already
  // typed into quantity/rate/dates for those rows. Custom rows are left as-is
  // since their name was hand-typed and isn't part of the bilingual list.
  useEffect(() => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.custom) return it;
        const match = particulars.find(
          (p) => (it.particularId && String(p._id) === String(it.particularId)) || p.no === it.no
        );
        return match ? { ...it, itemName: particularText(match, language) } : it;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    if (!isEdit) return;
    // Wait for the current particulars list before mapping the note's saved
    // items, so each one can be matched back to its fixed row correctly.
    settingsApi
      .get()
      .catch(() => null)
      .then((res) => {
        const currentParticulars = res?.data?.particulars?.length ? res.data.particulars : particulars;
        deliveryNoteApi.get(id).then((noteRes) => {
          const n = noteRes.data;
          setDate(new Date(n.date).toISOString().slice(0, 10));
          setUseNewCustomer(false);
          setCustomerId(n.customer?._id || n.customer);
          setVehicleNumber(n.vehicleNumber || '');
          setVehiclePhotoUrl(n.vehiclePhoto?.url || null);
          setReceiverPhotoUrl(n.receiverPhoto?.url || null);
          setItems(
            n.items.map((it) => {
              const matched = matchSavedItemToParticular(it, currentParticulars);
              return {
                _rowKey: nextRowKey(),
                itemName: it.itemName,
                quantity: it.quantity,
                rate: it.rate,
                custom: !matched,
                no: matched ? matched.no : '',
                particularId: matched ? matched._id : null,
                extra: it.extra || {},
                perDayRate: it.perDayRate || '',
                monthlyRate: it.monthlyRate || '',
                dateTaken: it.dateTaken ? new Date(it.dateTaken).toISOString().slice(0, 10) : '',
                dateReturned: it.dateReturned ? new Date(it.dateReturned).toISOString().slice(0, 10) : '',
                selectedVariant: it.selectedVariant || '',
              };
            })
          );
          setPaymentStatus(n.paymentStatus);
          setPaymentMode(n.paymentMode || 'Cash');
          setUpiRefNumber(n.upiRefNumber || '');
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const totals = useMemo(() => {
    return items.map((it) => computeItemAmount(it, itemColumns));
  }, [items, itemColumns]);

  const grandTotal = useMemo(() => totals.reduce((s, a) => s + a, 0), [totals]);

  // Custom rows get real sequential numbers continuing from the standard list
  // (e.g. after "19"), instead of a static "+" placeholder.
  const displayNumbers = useMemo(() => {
    const base = highestParticularNumber(particulars);
    let customSeen = 0;
    return items.map((it) => {
      if (!it.custom) return it.no || '';
      customSeen += 1;
      return String(base + customSeen);
    });
  }, [items, particulars]);

  // A particular's variant OPTIONS (the labels offered in the dropdown) come
  // from its own `variants` array, unless it opts into a shared list via
  // variantSizeSource (e.g. Column Box/Sheets both offering the same sizes -
  // see Settings.js particularSchema.variantSizeSource). Each label's
  // rate/perDayRate still comes from this particular's own `variants` entry
  // (falling back to 0/blank if the shared list has a size this particular
  // hasn't priced yet), so two linked particulars always show the same size
  // choices while billing them independently.
  const resolveVariantOptions = (particular) => {
    if (!particular) return [];
    if (particular.variantSizeSource === 'settings.sheetSizeOptions') {
      return sheetSizeOptions.map((label) => {
        const existing = (particular.variants || []).find((v) => v.label === label);
        return existing || { label, rate: 0, perDayRate: 0 };
      });
    }
    return particular.variants || [];
  };

  // Selecting a variant auto-fills that row's rate/perDayRate, the same way
  // standardRows() seeds a row's defaults from the particular itself.
  const updateItemVariant = (idx, variantLabel) => {
    itemsTouchedRef.current = true;
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const particular = findParticularForRow(it, particulars);
        const variant = resolveVariantOptions(particular).find((v) => v.label === variantLabel);
        if (!variant) return { ...it, selectedVariant: '' };
        return { ...it, selectedVariant: variantLabel, rate: variant.rate || '', perDayRate: variant.perDayRate || '' };
      })
    );
  };

  const updateItem = (idx, field, value) => {
    itemsTouchedRef.current = true;
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const updateItemExtra = (idx, key, value) => {
    itemsTouchedRef.current = true;
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, extra: { ...it.extra, [key]: value } } : it)));
  };

  const handleTopItemChange = (val) => {
    setExtraItemName(val);
    const matched = items.find((it) => it.itemName.toLowerCase() === val.trim().toLowerCase());
    if (matched) {
      setExtraPerDayRate(matched.perDayRate || '');
      setExtraMonthlyRate(matched.monthlyRate || '');
      setExtraDate(matched.dateTaken || '');
    } else {
      const pMatch = particulars.find(p => particularText(p, language).toLowerCase() === val.trim().toLowerCase());
      if (pMatch) {
        setExtraPerDayRate(pMatch.defaultPerDayRate || '');
        setExtraMonthlyRate(pMatch.defaultMonthlyRate || '');
      } else {
        setExtraPerDayRate('');
        setExtraMonthlyRate('');
      }
      setExtraDate('');
    }
  };

  const handleTopFieldChange = (field, value) => {
    if (field === 'perDayRate') setExtraPerDayRate(value);
    if (field === 'monthlyRate') setExtraMonthlyRate(value);
    if (field === 'dateTaken') setExtraDate(value);

    if (!extraItemName.trim()) return;
    const idx = items.findIndex((it) => it.itemName.toLowerCase() === extraItemName.trim().toLowerCase());
    if (idx !== -1) {
      setItems((prev) =>
        prev.map((it, i) => {
          if (i !== idx) return it;
          return { ...it, [field === 'dateTaken' ? 'dateTaken' : field]: value };
        })
      );
    }
  };

  const addRow = () => {
    itemsTouchedRef.current = true;
    setItems((prev) => [...prev, emptyItem()]);
  };
  const removeRow = (idx) => {
    itemsTouchedRef.current = true;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Mirrors the backend rule in deliveryNoteController.canEditVehiclePhoto:
  // anyone can add a photo while none exists yet; once one exists, only
  // Admin/Superadmin may replace or remove it. The server enforces this too,
  // so this is purely about showing the right controls, not real security.
  const canEditVehiclePhoto = !vehiclePhotoUrl || user?.role === 'admin' || user?.isSuperAdmin === true;

  const handlePhotoFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    setPhotoError('');
    setPhotoUploadedNotice('');
    if (!file) {
      setVehiclePhotoFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Photo is too large. Please choose an image under 5MB.');
      e.target.value = '';
      return;
    }
    setVehiclePhotoFile(file);
  };

  // Uploads immediately for an already-saved note (edit mode). In create
  // mode the file is uploaded automatically right after the note is created
  // (see handleSubmit) since there's no note id to attach it to before that.
  const handleUploadPhotoNow = async () => {
    if (!vehiclePhotoFile || !id) return;
    setPhotoError('');
    setPhotoUploadedNotice('');
    setPhotoUploading(true);
    try {
      const res = await deliveryNoteApi.uploadVehiclePhoto(id, vehiclePhotoFile);
      setVehiclePhotoUrl(res.data.vehiclePhoto?.url || null);
      setVehiclePhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      setPhotoUploadedNotice('Vehicle photo saved.');
    } catch (err) {
      setPhotoError(err.response?.data?.message || 'Failed to upload the photo. Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!id) return;
    setPhotoError('');
    setPhotoUploadedNotice('');
    setPhotoUploading(true);
    try {
      await deliveryNoteApi.removeVehiclePhoto(id);
      setVehiclePhotoUrl(null);
      setVehiclePhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      setPhotoUploadedNotice('Vehicle photo removed.');
    } catch (err) {
      setPhotoError(err.response?.data?.message || 'Failed to remove the photo. Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  };

  // Same rule as canEditVehiclePhoto, mirrored for the receiver photo.
  const canEditReceiverPhoto = !receiverPhotoUrl || user?.role === 'admin' || user?.isSuperAdmin === true;

  const handleReceiverPhotoFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    setReceiverPhotoError('');
    setReceiverPhotoUploadedNotice('');
    if (!file) {
      setReceiverPhotoFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiverPhotoError('Photo is too large. Please choose an image under 5MB.');
      e.target.value = '';
      return;
    }
    setReceiverPhotoFile(file);
  };

  const handleUploadReceiverPhotoNow = async () => {
    if (!receiverPhotoFile || !id) return;
    setReceiverPhotoError('');
    setReceiverPhotoUploadedNotice('');
    setReceiverPhotoUploading(true);
    try {
      const res = await deliveryNoteApi.uploadReceiverPhoto(id, receiverPhotoFile);
      setReceiverPhotoUrl(res.data.receiverPhoto?.url || null);
      setReceiverPhotoFile(null);
      if (receiverPhotoInputRef.current) receiverPhotoInputRef.current.value = '';
      setReceiverPhotoUploadedNotice('Receiver photo saved.');
    } catch (err) {
      setReceiverPhotoError(err.response?.data?.message || 'Failed to upload the photo. Please try again.');
    } finally {
      setReceiverPhotoUploading(false);
    }
  };

  const handleRemoveReceiverPhoto = async () => {
    if (!id) return;
    setReceiverPhotoError('');
    setReceiverPhotoUploadedNotice('');
    setReceiverPhotoUploading(true);
    try {
      await deliveryNoteApi.removeReceiverPhoto(id);
      setReceiverPhotoUrl(null);
      setReceiverPhotoFile(null);
      if (receiverPhotoInputRef.current) receiverPhotoInputRef.current.value = '';
      setReceiverPhotoUploadedNotice('Receiver photo removed.');
    } catch (err) {
      setReceiverPhotoError(err.response?.data?.message || 'Failed to remove the photo. Please try again.');
    } finally {
      setReceiverPhotoUploading(false);
    }
  };

  // Client-side OCR (Tesseract.js) - the pragmatic no-API-key default. A
  // server-side vision API would read a photographed Aadhaar card more
  // reliably, but that needs an API key/infra decision the founder hasn't
  // made yet, so this is what ships now. Never auto-submits - the extracted
  // text just pre-fills the fields above for the staff member to review.
  const handleAadhaarScan = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setAadhaarError('');
    setScanningAadhaar(true);
    // eslint-disable-next-line no-console
    console.log('[Aadhaar scan] file picked:', file.name, file.type, `${Math.round(file.size / 1024)}KB`);
    try {
      // Phone-camera photos are often 3000-4000px+ on the long edge - downscale
      // first so a slow/weaker device isn't stuck grinding through pixels OCR
      // doesn't need (see OCR_MAX_DIMENSION above).
      const scannableFile = await downscaleImageForOcr(file);
      // eslint-disable-next-line no-console
      console.log('[Aadhaar scan] downscaled OK, starting OCR + upload...');

      // Kick off the Cloudinary upload and the OCR read in parallel - one
      // shouldn't block the other, and a slow OCR pass shouldn't delay the
      // photo actually being saved (or vice versa).
      const uploadPromise = customerApi.uploadAadhaarScan(file).catch((err) => {
        // Don't let a failed photo upload block the auto-fill from OCR -
        // the person can still proceed with the extracted text fields even
        // if the photo itself didn't make it to Cloudinary this time.
        console.error('[Aadhaar scan] photo upload failed:', err?.response?.data || err?.message || err);
        return null;
      });

      // Self-hosted worker/core/language-data paths (see
      // scripts/copy-tesseract-assets.cjs) instead of tesseract.js's
      // default of fetching all three from cdn.jsdelivr.net at runtime -
      // any one of those three external requests failing (CSP, ad-blocker,
      // flaky mobile network, a hosting provider not forwarding the request
      // correctly) previously made a scan hang or silently never resolve.
      // The hard 20s timeout below is a second, independent safety net on
      // top of that: even a fully-loaded local OCR pass has no business
      // taking longer than that on the phone-camera-sized images this
      // handles, so if it ever does, fail fast with a clear message instead
      // of leaving the button stuck disabled forever.
      const Tesseract = await import('tesseract.js');
      const ocrPromise = Tesseract.recognize(scannableFile, 'eng', {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract',
        langPath: '/tesseract',
        logger: (m) => {
          // eslint-disable-next-line no-console
          console.log('[Aadhaar scan] tesseract:', m.status, m.progress);
        },
      }).catch((err) => {
        console.error('[Aadhaar scan] OCR itself threw:', err?.message || err, err);
        throw err;
      });
      // Prevent an unhandled-rejection warning if the timeout wins the race
      // and ocrPromise later rejects with nothing left listening to it.
      ocrPromise.catch(() => {});
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OCR timed out after 20s')), 20000);
      });
      const result = await Promise.race([ocrPromise, timeoutPromise]);
      // eslint-disable-next-line no-console
      console.log('[Aadhaar scan] OCR finished. Raw text:', result.data.text);

      const { name, address, phone } = extractAadhaarFields(result.data.text);
      // eslint-disable-next-line no-console
      console.log('[Aadhaar scan] extracted:', { name, address, phone });
      const uploadResult = await uploadPromise;

      if (!name && !address) {
        setAadhaarError('Load the Aadhaar card again.');
        return;
      }

      setNewCustomer((prev) => ({
        ...prev,
        name: name || prev.name,
        phone: phone || prev.phone,
        address: address || prev.address,
        ...(uploadResult
          ? {
              aadhaarPhoto: {
                url: uploadResult.data.url,
                publicId: uploadResult.data.publicId,
                uploadedAt: uploadResult.data.uploadedAt,
              },
            }
          : {}),
      }));
    } catch (err) {
      setAadhaarError('Load the Aadhaar card again.');
    } finally {
      setScanningAadhaar(false);
    }
  };

  // printAfter drives where we land after a successful save: the Billing
  // list (plain "Save Delivery Note") or straight to the print view (the
  // "Save & Print" button below) - both create/edit notes reuse this exact
  // save logic, since a brand-new note has no id to print until it's saved.
  const saveNote = async (printAfter) => {
    setError('');

    const cleanItems = items
      .filter((it) => it.itemName.trim() && Number(it.quantity) > 0)
      .map((it) => ({
        itemName: it.itemName.trim(),
        no: it.no || '',
        particularId: it.particularId || null,
        quantity: Number(it.quantity),
        rate: Number(it.rate) || 0,
        extra: it.extra || {},
        perDayRate: Number(it.perDayRate) || 0,
        monthlyRate: Number(it.monthlyRate) || 0,
        dateTaken: it.dateTaken || null,
        dateReturned: it.dateReturned || null,
        selectedVariant: it.selectedVariant || '',
      }));

    if (cleanItems.length === 0) {
      setError(t('deliveryForm.errorAddItem'));
      return;
    }

    if (!isVehicleNumberProvided(vehicleNumber)) {
      setError(VEHICLE_REQUIRED_HELP);
      return;
    }
    if (!isValidVehicleNumber(vehicleNumber)) {
      setError(`Invalid vehicle number. ${VEHICLE_HELP}`);
      return;
    }

    const payload = {
      date,
      vehicleNumber,
      items: cleanItems,
      paymentStatus,
      paymentMode,
      upiRefNumber: paymentMode === 'GPay/UPI' ? upiRefNumber : '',
    };
    if (!isEdit) {
      if (useNewCustomer) {
        if (!newCustomer.name || !newCustomer.phone) {
          setError(t('deliveryForm.errorCustomerRequired'));
          return;
        }
        if (!isValidPhone(newCustomer.phone)) {
          setError(`Invalid customer phone number. ${PHONE_HELP}`);
          return;
        }
        payload.newCustomer = newCustomer;
      } else {
        if (!customerId) {
          setError(t('deliveryForm.errorSelectCustomer'));
          return;
        }
        payload.customerId = customerId;
      }
    }

    setSaving(true);
    try {
      if (isEdit) {
        await deliveryNoteApi.update(id, payload);
        navigate(printAfter ? `/billing/${id}/print` : '/billing');
      } else {
        const res = await deliveryNoteApi.create(payload);
        // Photo upload is a second request after the note exists (a file
        // can't ride inside the JSON create payload above). If it fails, the
        // delivery note itself is still saved fine - only the photo needs a
        // retry, from the Edit screen, so this must not block navigation.
        if (vehiclePhotoFile) {
          try {
            await deliveryNoteApi.uploadVehiclePhoto(res.data._id, vehiclePhotoFile);
          } catch (photoErr) {
            console.error('Vehicle photo upload failed:', photoErr);
          }
        }
        if (receiverPhotoFile) {
          try {
            await deliveryNoteApi.uploadReceiverPhoto(res.data._id, receiverPhotoFile);
          } catch (photoErr) {
            console.error('Receiver photo upload failed:', photoErr);
          }
        }
        navigate(printAfter ? `/billing/${res.data._id}/print` : '/billing');
      }
    } catch (err) {
      setError(err.response?.data?.message || t('deliveryForm.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveNote(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEdit ? t('deliveryForm.editTitle') : t('deliveryForm.createTitle')}</h1>
        <BackButton fallbackTo="/billing" />
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <form className="panel form" onSubmit={handleSubmit}>
        <div className="form-grid form-grid-6">
          <div className="form-field">
            <label>{t('deliveryForm.dateLabel')}</label>
            <input type="date" className="date-field-compact" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="form-field">
            <label>{t('deliveryForm.vehicleLabel')}</label>
            <input
              className="vehicle-number-compact"
              placeholder="TN49CH8736"
              value={vehicleNumber}
              maxLength={13}
              required
              onChange={(e) => setVehicleNumber(sanitizeVehicleInput(e.target.value))}
            />
            {vehicleNumber && !isValidVehicleNumber(vehicleNumber) && (
              <span className="field-hint field-hint-error">{VEHICLE_HELP}</span>
            )}
            {!vehicleNumber && <span className="field-hint">{VEHICLE_REQUIRED_HELP}</span>}
          </div>

          {/* Hidden file input uses capture="environment" so tapping the button on a
              phone opens the camera directly instead of a generic file picker; desktop
              browsers ignore "capture" and fall back to a normal file dialog. */}
          <div className="form-field">
            <label>Vehicle Photo</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={photoInputRef}
              style={{ display: 'none' }}
              onChange={handlePhotoFileChange}
            />
            {canEditVehiclePhoto ? (
              <button
                type="button"
                className="btn btn-photo-capture"
                onClick={() => photoInputRef.current?.click()}
              >
                📷 {vehiclePhotoUrl || vehiclePhotoFilePreview ? 'Retake / Upload Photo' : 'Capture / Upload Photo'}
              </button>
            ) : (
              <span className="field-hint">Only Admin/Superadmin can change this photo.</span>
            )}
          </div>
          <div className="form-field">
            <label>Receiver Photo</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={receiverPhotoInputRef}
              style={{ display: 'none' }}
              onChange={handleReceiverPhotoFileChange}
            />
            {canEditReceiverPhoto ? (
              <button
                type="button"
                className="btn btn-photo-capture"
                onClick={() => receiverPhotoInputRef.current?.click()}
              >
                📷 {receiverPhotoUrl || receiverPhotoFilePreview ? 'Retake / Upload Photo' : 'Capture / Upload Photo'}
              </button>
            ) : (
              <span className="field-hint">Only Admin/Superadmin can change this photo.</span>
            )}
          </div>
          <div className="form-field">
            <label>{t('deliveryForm.paymentStatusLabel')}</label>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="Pending">{t('billing.pending')}</option>
              <option value="Paid">{t('billing.paid')}</option>
            </select>
          </div>
          <div className="form-field">
            <label>{t('voucher.paymentMode')}</label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="GPay/UPI">GPay/UPI</option>
              <option value="IMPS">IMPS</option>
              <option value="RTGS">RTGS</option>
              <option value="NEFT">NEFT</option>
            </select>
          </div>
          {paymentMode === 'GPay/UPI' && (
            <div className="form-field">
              <label>{t('voucher.upiRefNumber')}</label>
              <input value={upiRefNumber} onChange={(e) => setUpiRefNumber(e.target.value)} />
            </div>
          )}
        </div>

        {/* Preview of the captured/uploaded vehicle + receiver photos, shown
            side-by-side in one row (each block keeps its own internal
            thumbnail-then-buttons column layout via .vehicle-photo-block). */}
        <div className="vehicle-photo-row">
          {(vehiclePhotoUrl || vehiclePhotoFilePreview) && (
            <div className="vehicle-photo-block">
              <img src={vehiclePhotoFilePreview || vehiclePhotoUrl} alt="Vehicle" className="vehicle-photo-preview" />
              <div className="vehicle-photo-actions">
                {isEdit && vehiclePhotoFile && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={photoUploading}
                    onClick={handleUploadPhotoNow}
                  >
                    {photoUploading ? 'Uploading...' : vehiclePhotoUrl ? 'Save New Photo' : 'Save Photo'}
                  </button>
                )}
                {isEdit && vehiclePhotoUrl && !vehiclePhotoFile && canEditVehiclePhoto && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    disabled={photoUploading}
                    onClick={handleRemovePhoto}
                  >
                    Remove Photo
                  </button>
                )}
                {!isEdit && vehiclePhotoFile && (
                  <span className="field-hint">Photo will be saved automatically once this note is created.</span>
                )}
              </div>
            </div>
          )}

          {(receiverPhotoUrl || receiverPhotoFilePreview) && (
            <div className="vehicle-photo-block">
              <img src={receiverPhotoFilePreview || receiverPhotoUrl} alt="Receiver" className="vehicle-photo-preview" />
              <div className="vehicle-photo-actions">
                {isEdit && receiverPhotoFile && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={receiverPhotoUploading}
                    onClick={handleUploadReceiverPhotoNow}
                  >
                    {receiverPhotoUploading ? 'Uploading...' : receiverPhotoUrl ? 'Save New Photo' : 'Save Photo'}
                  </button>
                )}
                {isEdit && receiverPhotoUrl && !receiverPhotoFile && canEditReceiverPhoto && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    disabled={receiverPhotoUploading}
                    onClick={handleRemoveReceiverPhoto}
                  >
                    Remove Photo
                  </button>
                )}
                {!isEdit && receiverPhotoFile && (
                  <span className="field-hint">Photo will be saved automatically once this note is created.</span>
                )}
              </div>
            </div>
          )}
        </div>
        {photoError && <span className="field-hint field-hint-error">{photoError}</span>}
        {photoUploadedNotice && <span className="field-hint">{photoUploadedNotice}</span>}
        {receiverPhotoError && <span className="field-hint field-hint-error">{receiverPhotoError}</span>}
        {receiverPhotoUploadedNotice && <span className="field-hint">{receiverPhotoUploadedNotice}</span>}

        {!isEdit && (
          <div className="customer-block">
            <div className="toggle-row">
              <label>
                <input type="radio" checked={useNewCustomer} onChange={() => setUseNewCustomer(true)} />{' '}
                {t('deliveryForm.newCustomer')}
              </label>
              <label>
                <input type="radio" checked={!useNewCustomer} onChange={() => setUseNewCustomer(false)} />{' '}
                {t('deliveryForm.existingCustomer')}
              </label>
            </div>
            {useNewCustomer ? (
              <div className="form-grid">
                <div className="form-field">
                  <label>&nbsp;</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={aadhaarInputRef}
                    style={{ display: 'none' }}
                    onChange={handleAadhaarScan}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={scanningAadhaar}
                    onClick={() => aadhaarInputRef.current?.click()}
                  >
                    📷 Scan Aadhaar
                  </button>
                  {aadhaarError && <span className="field-hint field-hint-error">{aadhaarError}</span>}
                </div>
                <div className="form-field">
                  <label>{t('deliveryForm.customerName')}</label>
                  <input
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>{t('deliveryForm.customerPhone')}</label>
                  <input
                    value={newCustomer.phone}
                    maxLength={13}
                    placeholder="9876543210"
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: sanitizePhoneInput(e.target.value) })}
                    required
                  />
                  {newCustomer.phone && !isValidPhone(newCustomer.phone) && (
                    <span className="field-hint field-hint-error">{PHONE_HELP}</span>
                  )}
                </div>
                <div className="form-field">
                  <label>{t('deliveryForm.customerAddress')}</label>
                  <input
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="form-field">
                <label>{t('deliveryForm.selectCustomer')}</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                  <option value="">{t('deliveryForm.selectPlaceholder')}</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="form-grid" style={{ marginTop: '20px', marginBottom: '20px' }}>
          <div className="form-field">
            <label>Item Name</label>
            <input
              value={extraItemName}
              onChange={(e) => handleTopItemChange(e.target.value)}
              placeholder="Enter item name"
              list="particulars-list"
            />
            <datalist id="particulars-list">
              {particulars.map((p, idx) => (
                <option key={idx} value={particularText(p, language)} />
              ))}
            </datalist>
          </div>
          <div className="form-field">
            <label>Per-day Rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={extraPerDayRate}
              onChange={(e) => handleTopFieldChange('perDayRate', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="form-field">
            <label>Monthly Rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={extraMonthlyRate}
              onChange={(e) => handleTopFieldChange('monthlyRate', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="form-field">
            <label>Date</label>
            <input type="date" value={extraDate} onChange={(e) => handleTopFieldChange('dateTaken', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Month</label>
            <input
              value={extraMonth}
              onChange={(e) => setExtraMonth(e.target.value)}
              placeholder="e.g. July"
            />
          </div>
        </div>

        <h2>{t('deliveryForm.particulars')}</h2>
        <p className="amount-display particulars-tip" style={{ marginTop: 0 }}>
          Tip: leave Per-Day Rate blank for a normal item. Fill it in (with Date Taken / Date Returned) to bill
          rental equipment like scaffolding or pipes by the day instead of a flat rate.
        </p>
        <div className="items-scroll-area">
          <table className="data-table items-table stack-on-mobile">
          <thead>
            <tr>
              <th style={{ width: 50 }}>{t('deliveryForm.colNo')}</th>
              <th style={{ minWidth: 220 }}>{t('deliveryForm.colItemName')}</th>
              <th style={{ width: 130 }}>Variant</th>
              <th style={{ width: 100 }}>{t('deliveryForm.colQuantity')}</th>
              <th style={{ width: 110 }}>{t('deliveryForm.colRate')}</th>
              <th style={{ width: 120 }}>{t('deliveryForm.colPerDayRate')}</th>
              <th style={{ width: 120 }}>{t('deliveryForm.colMonthlyRate')}</th>
              <th style={{ width: 140 }}>{t('deliveryForm.colDateTaken')}</th>
              <th style={{ width: 140 }}>{t('deliveryForm.colDateReturned')}</th>
              {itemColumns.map((col) => (
                <th key={col._id} style={{ width: 130 }}>
                  {col.label}
                  {col.type === 'percent' ? ' (%)' : ''}
                </th>
              ))}
              <th style={{ width: 140 }}>{t('deliveryForm.colAmount')}</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it._rowKey ?? idx}>
                <td data-label={t('deliveryForm.colNo')}>{displayNumbers[idx]}</td>
                <td className="item-name-cell" data-label={t('deliveryForm.colItemName')}>
                  {it.custom ? (
                    <input
                      value={it.itemName}
                      title={it.itemName}
                      onChange={(e) => updateItem(idx, 'itemName', e.target.value)}
                    />
                  ) : (
                    <span className="item-name-display" title={it.itemName}>
                      {it.itemName}
                    </span>
                  )}
                </td>
                <td data-label="Variant">
                  {(() => {
                    const matchedParticular = findParticularForRow(it, particulars);
                    const rowVariants = resolveVariantOptions(matchedParticular);
                    if (rowVariants.length === 0) return null;
                    return (
                      <select value={it.selectedVariant || ''} onChange={(e) => updateItemVariant(idx, e.target.value)}>
                        <option value="">--</option>
                        {rowVariants.map((v) => (
                          <option key={v._id || v.label} value={v.label}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </td>
                <td data-label={t('deliveryForm.colQuantity')}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  />
                </td>
                <td data-label={t('deliveryForm.colRate')}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.rate}
                    onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                  />
                </td>
                <td data-label={t('deliveryForm.colPerDayRate')}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.perDayRate}
                    onChange={(e) => updateItem(idx, 'perDayRate', e.target.value)}
                  />
                </td>
                <td data-label={t('deliveryForm.colMonthlyRate')}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.monthlyRate}
                    onChange={(e) => updateItem(idx, 'monthlyRate', e.target.value)}
                  />
                </td>
                <td data-label={t('deliveryForm.colDateTaken')}>
                  <input type="date" value={it.dateTaken} onChange={(e) => updateItem(idx, 'dateTaken', e.target.value)} />
                </td>
                <td data-label={t('deliveryForm.colDateReturned')}>
                  <input type="date" value={it.dateReturned} onChange={(e) => updateItem(idx, 'dateReturned', e.target.value)} />
                </td>
                {itemColumns.map((col) => (
                  <td key={col._id} data-label={col.label}>
                    <input
                      type={col.type === 'text' ? 'text' : 'number'}
                      min={col.type === 'text' ? undefined : '0'}
                      step={col.type === 'text' ? undefined : '0.01'}
                      value={(it.extra && it.extra[col.key]) || ''}
                      onChange={(e) => updateItemExtra(idx, col.key, e.target.value)}
                    />
                  </td>
                ))}
                <td className="amount-cell" data-label={t('deliveryForm.colAmount')}>
                  <span className="amount-box">{formatCurrency(totals[idx] || 0)}</span>
                </td>
                <td>
                  {it.custom && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeRow(idx)}>
                      x
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={9 + itemColumns.length} className="total-label">
                {t('deliveryForm.grandTotal')}
              </td>
              <td className="amount-cell total-amount">{formatCurrency(grandTotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <button type="button" className="btn btn-ghost" onClick={addRow}>
          {t('deliveryForm.addCustomItem')}
        </button>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/billing')}>
            {t('deliveryForm.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('deliveryForm.saving') : t('deliveryForm.save')}
          </button>
        </div>
        </div>
      </form>
    </div>
  );
}
