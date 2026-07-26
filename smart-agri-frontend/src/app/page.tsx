import Link from 'next/link';
import { ArrowRight, Sprout, Activity, ShieldCheck } from 'lucide-react';

export default function WelcomePage() {
  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden font-sans">
      
      {/* Background Image - Immersive Full Screen */}
      <img 
        src="/welcome-banner.png" 
        alt="Smart Agriculture" 
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Deep Gradient Overlays for Readability & Drama */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/60" />

      {/* Central Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-2xl px-6 sm:px-12 py-12 sm:py-16 mx-4 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] flex flex-col items-center text-center animate-fade-in mt-12 sm:mt-0">
        
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)] bg-white p-1 mb-6 ring-1 ring-white/20">
          <img src="/logo.jpg" alt="AgriBot Logo" className="w-full h-full object-contain rounded-xl" />
        </div>

        {/* Headings */}
        <h1 className="text-4xl sm:text-6xl font-extrabold mb-3 tracking-tight text-white drop-shadow-md">
          AgriBot
        </h1>
        
        <h2 className="text-xs sm:text-sm font-bold tracking-[0.25em] uppercase mb-8 text-emerald-400">
          Smart Agriculture System
        </h2>

        <p className="text-base sm:text-lg leading-relaxed mb-10 text-slate-300 max-w-lg">
          Welcome to the future of farming. Monitor soil health, track weather conditions, and analyze field data with AI-powered insights.
        </p>

        {/* Feature Badges - Horizontal on desktop, vertical on mobile */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-12 w-full">
          <div className="flex items-center gap-2 text-white/90 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <Sprout className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium">Precision AI</span>
          </div>
          <div className="flex items-center gap-2 text-white/90 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">Real-time Data</span>
          </div>
          <div className="flex items-center gap-2 text-white/90 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium">Smart Dosing</span>
          </div>
        </div>

        {/* CTA Button */}
        <Link href="/login" className="group w-full sm:w-auto">
          <button className="flex items-center justify-center gap-3 w-full sm:w-auto bg-green-500 hover:bg-green-400 text-slate-900 font-bold py-4 px-10 rounded-xl transition-all duration-300 shadow-[0_0_40px_rgba(34,197,94,0.4)] hover:shadow-[0_0_60px_rgba(34,197,94,0.6)] hover:-translate-y-1 active:translate-y-0 text-lg">
            <span>Proceed to Login</span>
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
        </Link>
        
      </div>
    </div>
  );
}
