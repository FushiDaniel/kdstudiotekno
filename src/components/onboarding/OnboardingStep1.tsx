'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CreditCard, ListChecks, ArrowRight } from "lucide-react";

interface OnboardingStep1Props {
  onNext: () => void;
}

export default function OnboardingStep1({ onNext }: OnboardingStep1Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto space-y-8">
        {/* Logo Section */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
            <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">KD</span>
            </div>
          </div>
          <div>
            <p className="text-lg text-gray-600">Selamat Datang ke</p>
            <h1 className="text-3xl font-bold text-gray-900">KDStudio</h1>
          </div>
        </div>

        {/* Features Section */}
        <div className="space-y-6">
          <FeatureCard
            icon={<Clock className="w-6 h-6" />}
            title="Masa Kerja"
            description="Urus masa kerja anda dengan mudah dan efisien"
          />
          
          <FeatureCard
            icon={<ListChecks className="w-6 h-6" />}
            title="Tugasan"
            description="Pantau dan urus tugasan harian anda"
          />
          
          <FeatureCard
            icon={<CreditCard className="w-6 h-6" />}
            title="Gaji & Bayaran"
            description="Lihat gaji dan sejarah pembayaran anda"
          />
        </div>

        {/* Next Button */}
        <Button 
          onClick={onNext}
          className="w-full h-12 bg-black text-white hover:bg-gray-800 rounded-xl"
        >
          Seterusnya
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}