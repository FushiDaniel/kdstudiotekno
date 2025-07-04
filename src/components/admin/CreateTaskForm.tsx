'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskStatus, TaskPaymentStatus } from '@/types';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { X, Plus } from 'lucide-react';

interface CreateTaskFormProps {
  onClose: () => void;
  onTaskCreated?: () => void;
}

export default function CreateTaskForm({ onClose, onTaskCreated }: CreateTaskFormProps) {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    deadline: '',
    skills: [] as string[]
  });
  const [newSkill, setNewSkill] = useState('');

  const handleAddSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setIsCreating(true);
      const now = new Date();
      
      const newTask = {
        name: formData.name,
        description: formData.description,
        amount: parseFloat(formData.amount),
        deadline: new Date(formData.deadline),
        skills: formData.skills,
        status: TaskStatus.NOT_STARTED,
        paymentStatus: TaskPaymentStatus.NOT_STARTED,
        createdBy: user.uid,
        createdByName: user.fullname,
        createdAt: Timestamp.fromDate(now),
        assignedTo: null,
        assignedToName: null,
        assignedToStaffId: null
      };

      await addDoc(collection(db, 'tasks'), newTask);
      onTaskCreated?.();
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-gray-900">Cipta Tugasan Baru</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Nama Tugasan *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Masukkan nama tugasan"
                required
                className="w-full bg-white text-gray-900 border-gray-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Penerangan *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Terangkan tugasan ini..."
                className="w-full p-3 border border-gray-300 rounded-md resize-none h-24 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Jumlah Bayaran (RM) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                  className="w-full bg-white text-gray-900 border-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Tarikh Akhir *
                </label>
                <Input
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                  required
                  className="w-full bg-white text-gray-900 border-gray-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Kemahiran Diperlukan
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="Tambah kemahiran..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                  className="flex-1 bg-white text-gray-900 border-gray-300"
                />
                <Button 
                  type="button" 
                  onClick={handleAddSkill} 
                  size="icon"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {formData.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-900 rounded-md text-sm"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="text-gray-500 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex space-x-2 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                className="flex-1 bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                disabled={isCreating} 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isCreating ? 'Mencipta...' : 'Cipta Tugasan'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}