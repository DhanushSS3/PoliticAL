import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Phone } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import OTPVerification from './OTPVerification';

// Use centralized API client (src/utils/api.ts) for baseURL and credentials

interface FormData {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  phone?: string;
}

const RegisterSection: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [tempUserData, setTempUserData] = useState<FormData | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('Registration successful! You can now sign in.');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.passwordConfirm) {
      setError('Passwords do not match');
      return;
    }

    // Validate phone number if provided
    if (formData.phone && !/^\+?[1-9]\d{1,14}$/.test(formData.phone)) {
      setError('Please provide a valid phone number with country code (e.g., +1234567890)');
      return;
    }

    try {
      setIsLoading(true);
      
      // Prepare the data to send
      const userData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        passwordConfirm: formData.passwordConfirm,
        phone: formData.phone || undefined // Only include if provided
      };
      
      // Try to sign up the user
      console.log('[UI] Signup request →', { url: `/api/v1/auth/signup`, payload: userData });
      const resp = await api.post(`/api/v1/auth/signup`, userData);
      console.log('[UI] Signup response ←', resp.status, resp.data);
      
      // If we get here, the user either:
      // 1. Is new and needs to verify their email (status 201)
      // 2. Exists but is unverified (status 200)
      setTempUserData({ ...formData });
      setShowOTP(true);
      
    } catch (error: any) {
      console.error('[UI] Signup error ×', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      // Handle specific error for existing verified user
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        setError('An account with this email already exists. Please log in instead.');
      } else {
        setError(error.response?.data?.message || 'Failed to process your request. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerify = async (otp: string): Promise<boolean> => {
    if (!tempUserData) return false;
    
    try {
      console.log('[UI] Verify OTP request →', { url: `/api/v1/auth/verify-otp`, email: tempUserData.email, otp });
      const response = await api.post(`/api/v1/auth/verify-otp`, {
        email: tempUserData.email,
        otp
      });
      console.log('[UI] Verify OTP response ←', response.status, response.data);
      const token = (response.data as any)?.data?.token ?? (response.data as any)?.token;
      const user = (response.data as any)?.data?.user ?? (response.data as any)?.user;
      if (response.status === 200 && (token || user)) {
        setSuccessMsg('Account verified successfully! You can now sign in.');
        setShowSuccess(true);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('[UI] Verify OTP error ×', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      return false;
    }
  };
  
  const handleResendOTP = async (): Promise<boolean> => {
    if (!tempUserData) return false;
    
    try {
      console.log('[UI] Resend OTP request →', { url: `/api/v1/auth/resend-otp`, email: tempUserData.email });
      const resp = await api.post(`/api/v1/auth/resend-otp`, {
        email: tempUserData.email
      });
      console.log('[UI] Resend OTP response ←', resp.status, resp.data);
      return true;
    } catch (error: any) {
      console.error('[UI] Resend OTP error ×', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      return false;
    }
  };
  
  const handleBackToRegister = () => {
    setShowOTP(false);
    setError('');
  };
  
  

  if (showOTP && tempUserData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <OTPVerification 
          email={tempUserData.email}
          onVerify={handleOTPVerify}
          onResend={handleResendOTP}
          onBack={handleBackToRegister}
        />
        {/* Success Card Modal */}
        {showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center relative">
              <button
                type="button"
                onClick={() => { setShowSuccess(false); navigate('/login'); }}
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                {/* simple X icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M6.225 4.811a.75.75 0 0 1 1.06 0L12 9.525l4.715-4.714a.75.75 0 1 1 1.06 1.06L13.06 10.586l4.715 4.714a.75.75 0 1 1-1.06 1.061L12 11.646l-4.715 4.715a.75.75 0 1 1-1.06-1.061l4.714-4.714-4.714-4.714a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                {/* Check icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path fillRule="evenodd" d="M2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75 2.25 17.385 2.25 12zm13.036-2.286a.75.75 0 1 0-1.072-1.048l-4.34 4.44-1.628-1.63a.75.75 0 1 0-1.063 1.06l2.167 2.167a.75.75 0 0 0 1.078-.006l4.858-4.983z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Success</h3>
              <p className="mt-2 text-sm text-gray-600">{successMsg}</p>
              <button
                type="button"
                onClick={() => { setShowSuccess(false); navigate('/login'); }}
                className="mt-5 w-full rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 transition"
              >
                Go to Login
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex rounded-lg shadow-lg overflow-hidden max-w-4xl w-full my-8">
        {/* Left Panel */}
        <div className="w-1/2 bg-gradient-to-br from-indigo-600 to-purple-600 p-12 text-white hidden md:flex flex-col justify-center">
          <h1 className="text-4xl font-extrabold mb-4">Join Our Community</h1>
          <p className="text-lg mb-8">
            Unlock your potential. Get access to exclusive courses, tools, and a vibrant community of learners and professionals.
          </p>
          <ul className="space-y-4">
            <li className="flex items-center">
              <ArrowRight className="w-6 h-6 mr-2 text-green-400" />
              <span>Personalized Career Paths</span>
            </li>
            <li className="flex items-center">
              <ArrowRight className="w-6 h-6 mr-2 text-green-400" />
              <span>Expert-led Courses</span>
            </li>
            <li className="flex items-center">
              <ArrowRight className="w-6 h-6 mr-2 text-green-400" />
              <span>Cutting-edge Job Tools</span>
            </li>
            <li className="flex items-center">
              <ArrowRight className="w-6 h-6 mr-2 text-green-400" />
              <span>24/7 Support</span>
            </li>
          </ul>
        </div>

        {/* Right Panel */}
        <div className="w-full md:w-1/2 p-8 md:p-12 bg-gray-50">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Get Started</h2>
          <p className="text-gray-600 mb-8">Create your account to begin your journey.</p>

          

          {error && (
            <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="full-name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="full-name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-2">
                Gmail address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  minLength={6}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
             <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirm-password"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition duration-200"
                />
              </div>
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number (with country code)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
                  isLoading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors`}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterSection;
