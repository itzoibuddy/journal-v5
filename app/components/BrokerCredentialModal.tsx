import { useEffect, useRef, useState } from 'react';

interface BrokerCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (credentials: Record<string, string>) => Promise<void>;
  title: string;
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'password' | 'number' | 'select';
    required: boolean;
    description?: string;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
  }>;
  loading?: boolean;
  error?: string | null;
  helper?: { url: string; instructions: string } | null;
}

export default function BrokerCredentialModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  fields,
  loading = false,
  error = null,
  helper = null,
}: BrokerCredentialModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [showTotpHelp, setShowTotpHelp] = useState(false);
  const [showApiKeyHelp, setShowApiKeyHelp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({});
      setTouched({});
      setLocalError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required fields
    for (const field of fields) {
      if (field.required && !form[field.name]) {
        setLocalError(`${field.label} is required.`);
        setTouched((prev) => ({ ...prev, [field.name]: true }));
        return;
      }
    }
    setLocalError(null);
    await onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-gray-900/80 via-blue-900/80 to-indigo-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={modalRef}
        className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 max-w-lg w-full max-h-[95vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-gray-200/50 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white text-sm font-bold">🔑</span>
            </div>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl hover:bg-white/90 text-gray-600 hover:text-gray-800 transition-all duration-300"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Modal Content */}
        <form className="px-8 py-6 max-h-[calc(95vh-120px)] overflow-y-auto" onSubmit={handleSubmit}>
          {title.includes('Angel One') && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <b>To connect Angel One, you need:</b>
              <ul className="list-disc ml-5 mt-1">
                <li>Your Angel One Client Code</li>
                <li>Your Angel One Trading PIN</li>
                <li>Your State (as required by Angel One API)</li>
                <li>
                  TOTP (required for API access):
                  <span className="ml-1">
                    <a href="https://smartapi.angelbroking.com/enable-totp" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Enable TOTP via SmartAPI</a>
                  </span>
                </li>
              </ul>
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                <b>Important:</b> TOTP is required for Angel One API access. You must enable it through the SmartAPI portal, not the regular Angel One app.
              </div>
            </div>
          )}
          {fields.map((field) => (
            <div key={field.name} className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center" htmlFor={field.name}>
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
                {field.name === 'totp' && (
                  <span className="ml-2 relative group cursor-pointer">
                    <svg className="w-4 h-4 text-blue-500 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                    </svg>
                    <div className="absolute left-1/2 z-50 hidden group-hover:block group-focus:block w-72 -translate-x-1/2 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg text-xs text-gray-700">
                      <b>How to get TOTP:</b><br/>
                      1. Visit <a href="https://smartapi.angelbroking.com/enable-totp" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">smartapi.angelbroking.com/enable-totp</a><br/>
                      2. Log in with your Client ID and password<br/>
                      3. Follow the setup process to add TOTP to your authenticator app<br/>
                      4. Use the 6-digit code from your authenticator app here
                    </div>
                  </span>
                )}
                {field.name === 'apiKey' && title.includes('Angel One') && (
                  <span className="ml-2 relative group cursor-pointer">
                    <a href="#" className="text-blue-600 underline" onClick={e => { e.preventDefault(); setShowApiKeyHelp(true); }}>
                      How to get your API Key?
                    </a>
                  </span>
                )}
              </label>
              {field.type === 'select' ? (
                <select
                  id={field.name}
                  name={field.name}
                  required={field.required}
                  value={form[field.name] || ''}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${touched[field.name] && field.required && !form[field.name] ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={loading}
                >
                  <option value="">{field.placeholder || 'Select an option'}</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  required={field.required}
                  value={form[field.name] || ''}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${touched[field.name] && field.required && !form[field.name] ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={loading}
                  autoComplete="off"
                />
              )}
              {field.description && (
                <div className="text-xs text-gray-500 mt-1">{field.description}</div>
              )}
              {touched[field.name] && field.required && !form[field.name] && (
                <div className="text-xs text-red-500 mt-1">{field.label} is required.</div>
              )}
              {field.name === 'totp' && (
                <div className="text-xs text-blue-700 mt-1">
                  <a href="#" className="text-blue-600 underline" onClick={e => { e.preventDefault(); setShowTotpHelp(v => !v); }}>
                    {showTotpHelp ? 'Hide' : "Can't find TOTP?"}
                  </a>
                </div>
              )}
              {field.name === 'totp' && showTotpHelp && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                  <b>How to set up TOTP for Angel One SmartAPI:</b><br/>
                  <br/>
                  <b>Step 1: Go to SmartAPI TOTP Setup</b><br/>
                  • Open your browser and visit: <a href="https://smartapi.angelbroking.com/enable-totp" target="_blank" rel="noopener noreferrer" className="underline">smartapi.angelbroking.com/enable-totp</a><br/>
                  <br/>
                  <b>Step 2: Log in to SmartAPI</b><br/>
                  • Enter your Angel One Client ID and password/PIN<br/>
                  • Click Submit<br/>
                  <br/>
                  <b>Step 3: Verify OTP</b><br/>
                  • Angel One will send an OTP to your registered mobile/email<br/>
                  • Enter the OTP to continue<br/>
                  <br/>
                  <b>Step 4: Add TOTP to Authenticator App</b><br/>
                  • After OTP validation, a QR code will appear<br/>
                  • Open Google Authenticator or Microsoft Authenticator<br/>
                  • Scan the QR code to add Angel One account<br/>
                  <br/>
                  <b>Step 5: Use TOTP for API Access</b><br/>
                  • Your authenticator app will generate 6-digit codes every 30 seconds<br/>
                  • Use these codes when connecting to Angel One API<br/>
                  <br/>
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                    <b>Important:</b> TOTP is only available through SmartAPI, not the regular Angel One mobile app. You must use the SmartAPI portal to enable TOTP.
                  </div>
                </div>
              )}
            </div>
          ))}
          {(localError || error) && (
            <div className="mb-4 text-red-600 text-sm font-medium">
              {localError || error}
              {(error && error.toLowerCase().includes('invalid totp')) && (
                <div className="mt-2 text-xs text-blue-700">
                  Having trouble? <a href="https://smartapi.angelbroking.com/enable-totp" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Enable TOTP via SmartAPI here.</a>
                </div>
              )}
            </div>
          )}
          {helper && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800 mb-2">{helper.instructions}</div>
              <a
                href={helper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Open Zerodha Login
              </a>
            </div>
          )}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-semibold hover:from-indigo-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
      {showApiKeyHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
            <button onClick={() => setShowApiKeyHelp(false)} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl">&times;</button>
            <h2 className="text-xl font-bold mb-4 text-blue-900">How to generate your Angel One SmartAPI Key</h2>
            <ol className="list-decimal ml-6 text-sm text-gray-800 space-y-2">
              <li>
                Go to <a href="https://smartapi.angelbroking.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">smartapi.angelbroking.com</a> and log in with your Angel One client code and registered mobile/email.
              </li>
              <li>
                Click <b>My Apps</b> in the sidebar, then click <b>Create New App</b>.
              </li>
              <li>
                Fill in the app details (App Name, Description, etc.). For Redirect URL, you can use <code>https://localhost</code> if unsure.
              </li>
              <li>
                Submit the form. Your <b>API Key</b> and <b>API Secret</b> will be shown on the app details page. Copy them.
              </li>
              <li>
                If you haven't enabled TOTP, go to <a href="https://smartapi.angelbroking.com/enable-totp" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Enable TOTP</a> and follow the instructions.
              </li>
            </ol>
            <div className="mt-4 text-xs text-gray-600">
              <b>Tip:</b> You only need to do this once. Keep your API Key and Secret safe!
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 