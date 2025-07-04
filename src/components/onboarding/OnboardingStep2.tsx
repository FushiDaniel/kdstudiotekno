'use client';

import { Button } from "@/components/ui/button";

interface OnboardingStep2Props {
  onComplete: () => void;
}

export default function OnboardingStep2({ onComplete }: OnboardingStep2Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto space-y-8 text-center">
        {/* Logo Section */}
        <div className="space-y-4">
          <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
            <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">KD</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Selamat Datang!</h1>
            <p className="text-lg text-gray-600 mt-2">
              Anda sudah bersedia untuk memulakan perjalanan anda dengan KDStudio.
            </p>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Apa yang boleh anda lakukan:
            </h2>
            <ul className="space-y-3 text-left">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span className="text-gray-700">Pantau tugasan dan deadline</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span className="text-gray-700">Jejak masa kerja dengan Clock In/Out</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span className="text-gray-700">Lihat pendapatan dan bayaran</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span className="text-gray-700">Berkomunikasi dengan admin</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Complete Button */}
        <Button 
          onClick={onComplete}
          className="w-full h-12 bg-black text-white hover:bg-gray-800 rounded-xl"
        >
          Mula Sekarang
        </Button>
      </div>
    </div>
  );
}