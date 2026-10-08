import { useState, useEffect } from 'react'
import axios from 'axios'
import { Upload, UserPlus, Zap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import Dashboard from './Dashboard'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'

function App() {
  const [onboarded, setOnboarded] = useState(false)
  const [clinicianId, setClinicianId] = useState(null)
  const [clinicianName, setClinicianName] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [files, setFiles] = useState([])
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [voiceProfile, setVoiceProfile] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showDashboard, setShowDashboard] = useState(false)

  // Auto-login for dev (remember last clinician and restore their profile)
  useEffect(() => {
    const savedId = localStorage.getItem('therapy_admin_id')
    if (savedId) {
      axios.get(`${API_BASE}/clinicians/${savedId}`)
        .then(res => {
          const clinician = res.data.clinician
          setClinicianId(clinician.id)
          setClinicianName(clinician.full_name)
          if (clinician.voice_profile) {
            setVoiceProfile(clinician.voice_profile)
          }
          setOnboarded(true)
          setShowDashboard(true)
        })
        .catch(err => {
          console.error('Failed to restore session:', err)
          localStorage.clear()
        })
    }
  }, [])

  const handleOnboard = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await axios.post(`${API_BASE}/clinicians`, { email, full_name: name })
      setClinicianId(res.data.id)
      setClinicianName(name)
      localStorage.setItem('therapy_admin_id', res.data.id)
      localStorage.setItem('therapy_admin_name', name)
      setOnboarded(true)
      setMessage('Account created! Now upload 3-5 reference documents.')
    } catch (err) {
      setError(err.response?.data?.error || 'Onboarding failed')
    }
  }

  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files)
    setError('')
    setMessage('Uploading documents...')
    
    for (const file of uploadedFiles) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        await axios.post(`${API_BASE}/upload/${clinicianId}`, formData)
        setFiles(prev => [...prev, file.name])
      } catch (err) {
        console.error('File upload error:', err)
        setError(`Failed to upload ${file.name}`)
      }
    }
    setMessage('Documents uploaded and processed.')
  }

  const handleCalibrate = async () => {
    setIsCalibrating(true)
    setError('')
    try {
      const res = await axios.post(`${API_BASE}/calibrate/${clinicianId}`)
      setVoiceProfile(res.data.profile)
      setMessage('Voice Calibration Complete!')
      setTimeout(() => setShowDashboard(true), 1500)
    } catch (err) {
      console.error('Calibration error:', err)
      setError('Calibration failed. Ensure your GEMINI_API_KEY is set in backend/.env')
    } finally {
      setIsCalibrating(false)
    }
  }

  const handleReset = () => {
    localStorage.clear()
    window.location.reload()
  }

  if (showDashboard) {
    return <Dashboard 
      clinicianId={clinicianId} 
      clinicianName={clinicianName} 
      voiceProfile={voiceProfile}
      onReset={handleReset}
    />
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 border-b pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 italic">TherapyAdmin AI</h1>
          <p className="text-gray-600 italic text-lg">Onboarding & Voice Calibration System (Gemini Pro)</p>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" /> {error}
          </div>
        )}

        {message && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 flex items-center italic font-medium">
            <CheckCircle className="w-5 h-5 mr-2" /> {message}
          </div>
        )}

        {!onboarded ? (
          <section className="bg-white p-8 rounded-xl border shadow-sm max-w-md mx-auto italic">
            <h2 className="text-xl font-semibold mb-6 flex items-center">
              <UserPlus className="w-5 h-5 mr-2 text-indigo-600" /> Onboard Clinician
            </h2>
            <form onSubmit={handleOnboard} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  type="email"
                  className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
              </div>
              <button className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition-colors">
                Create Profile
              </button>
            </form>
          </section>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            <section className="bg-white p-8 rounded-xl border shadow-sm italic">
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <Upload className="w-5 h-5 mr-2 text-indigo-600" /> Reference Documents
              </h2>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-500/50 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  multiple 
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Click to upload PDFs or text files</p>
                <p className="text-xs text-gray-400 mt-1">Upload 3-5 existing letters, notes, or emails</p>
              </div>
              
              {files.length > 0 && (
                <ul className="mt-6 space-y-2">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-md">
                      <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> {f}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white p-8 rounded-xl border shadow-sm italic">
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-indigo-600" /> Voice Calibration
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Once documents are uploaded, our engine extracts your unique writing style, 
                tone, and professional vocabulary.
              </p>
              
              {!voiceProfile ? (
                <button 
                  onClick={handleCalibrate}
                  disabled={files.length === 0 || isCalibrating}
                  className="w-full flex items-center justify-center bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-200"
                >
                  {isCalibrating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Calibrate Voice'}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg animate-in fade-in duration-500">
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Extracted Voice Profile</p>
                    <ul className="text-sm space-y-2 text-indigo-900">
                      <li><span className="font-semibold">Tone:</span> {voiceProfile.tone}</li>
                      <li><span className="font-semibold">Structure:</span> {voiceProfile.sentence_structure}</li>
                      <li><span className="font-semibold">Formality:</span> {Math.round(voiceProfile.formality * 100)}%</li>
                    </ul>
                  </div>
                  <p className="text-sm text-center text-indigo-600 font-medium">Entering Dashboard...</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
