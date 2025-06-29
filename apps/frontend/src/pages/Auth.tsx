import { motion } from 'framer-motion';
import { Chrome, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import ParticleBackground from '../components/ParticleBackground';
import axios from 'axios';
import { useEffect, useState } from 'react';
import {
  getAuth,
  signInWithPopup,
  // signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY || "",
  authDomain: import.meta.env.VITE_AUTH_DOMAIN || "", 
  projectId: import.meta.env.VITE_PROJECT_ID || ""
};

console.log(firebaseConfig);


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const url = 'http://localhost:3000/v1';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Sync user to backend database
  const syncUserToBackend = async (user: User) => {
    try {
      const token = await user.getIdToken();
      const response = await axios.post(`${url}/sync-user`, {
        uid: user.uid,
        email: user.email,
        name: user.displayName || 'Anonymous',
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('User synced to backend:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to sync user to backend:', error);
      throw error;
    }
  };

  // Set user in context and navigate
  const handleUserAuthenticated = async (user: User) => {
    try {
      // Wait for email verification if required
      if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
        setMessage('Please check your email and verify your account before continuing.');
        return;
      }

      // Sync to backend
      await syncUserToBackend(user);

      // Set user in context
      setUser({
        id: user.uid,
        name: user.displayName || '',
        email: user.email || '',
        avatar: user.photoURL || '',
        provider: 'google' ,
        stats: {
          totalMatches: 0,
          wins: 0,
          losses: 0,
          rank: 0,
          bestTime: 0,
        },
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error handling authenticated user:', error);
      setError('Failed to complete authentication. Please try again.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Use popup for better UX
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const idToken = await user.getIdToken();
      await axios.post(
        "http://localhost:3000/v1/sync-user", 
        {
          email: user.email,
          name: user.displayName || "",
        },
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );
      // Directly handle the authenticated user
      await handleUserAuthenticated(user);
    } catch (error) {
      console.error('Google login failed:', error);
      
      // Handle specific popup errors
      if ((error as { code: string }).code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled.');
      } else if ((error as { code: string }).code === 'auth/popup-blocked') {
        setError('Popup blocked. Please allow popups and try again.');
      } else {
        setError('Google login failed. Please try again.');
      }
      setLoading(false);
    }
  };

  // Handle email/password signup
  const handleSignupWithEmail = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // Send email verification
      await sendEmailVerification(user);
      setMessage('Verification email sent! Please check your email and verify your account.');
      
      const token = await user.getIdToken();
      const response = await axios.post(`${url}/sync-user`, {
        uid: user.uid,
        email: user.email,
        name: user.displayName || 'Anonymous',
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('User synced to backend:', response.data);
      return response.data;
      // Note: We don't automatically sign in until email is verified
      // The onAuthStateChanged listener will handle the rest
    } catch (error) {
      console.error('Signup failed:', error);
      setError(error instanceof Error ? error.message : 'Signin failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle email/password signin
  const handleSigninWithEmail = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log(result);
      
      // The onAuthStateChanged listener will handle the rest
    } catch (error) {
      console.error('Signin failed:', error);
      setError(error instanceof Error ? error.message : 'Signin failed. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Handle redirect result for Google sign-in
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          handleUserAuthenticated(result.user);
        }
      })
      .catch((error) => {
        console.error('Error during redirect login:', error);
        setError('Authentication failed. Please try again.');
      });

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.emailVerified) {
        handleUserAuthenticated(user);
      } else if (user && !user.emailVerified && user.providerData[0]?.providerId === 'password') {
        setMessage('Please verify your email address to continue.');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center relative"
    >
      <ParticleBackground />

      <div className="container mx-auto px-4 relative z-10">
        <motion.button
          onClick={() => navigate('/')}
          className="absolute top-8 left-8 p-2 text-cyan-400 hover:text-white transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft className="w-6 h-6" />
        </motion.button>

        <motion.div
          className="max-w-md mx-auto"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="glass-effect rounded-2xl p-8 text-center">
            <motion.h1
              className="text-4xl font-bold mb-2 gradient-text"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              {isSignUp ? 'Sign up to Compete' : 'Sign in to Compete'}
            </motion.h1>

            <motion.p
              className="text-gray-300 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              Choose your preferred authentication method
            </motion.p>

            {/* Error/Success Messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-200">
                {message}
              </div>
            )}

            <div className="space-y-4">
              {/* Google Sign In */}
              <motion.button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 mb-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl font-semibold hover:from-red-400 hover:to-orange-400 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
              >
                <Chrome className="w-5 h-5" />
                Continue with Google
              </motion.button>

              <div className="text-gray-400 my-4">OR</div>
              
              {/* Email & Password */}
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="space-y-3"
              >
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-6 py-4 bg-gradient-to-r from-gray-700 to-gray-900 rounded-xl font-semibold hover:from-gray-600 hover:to-gray-800 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-6 py-4 bg-gradient-to-r from-gray-700 to-gray-900 rounded-xl font-semibold hover:from-gray-600 hover:to-gray-800 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                
                <button 
                  className="w-full mt-3 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={isSignUp ? handleSignupWithEmail : handleSigninWithEmail}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                </button>
              </motion.div>

              <motion.div
                className="mt-6"
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1.1 }}
              >
                <span className="text-gray-400">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                </span>
                <button 
                  className="ml-2 text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                    setMessage('');
                  }}
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </motion.div>
            </div>      

            <motion.div
              className="mt-8 text-sm text-gray-400"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.3 }}
            >
              By signing in, you agree to our Terms of Service and Privacy Policy
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Auth;