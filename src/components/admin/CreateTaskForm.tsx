'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Task, TaskStatus, TaskPaymentStatus } from '@/types';
import { collection, addDoc, Timestamp, getDocs, query, setDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { X, Plus } from 'lucide-react';
import { notificationService } from '@/lib/notifications';

interface CreateTaskFormProps {
  onClose: () => void;
  onTaskCreated?: () => void;
  editingTask?: Task | null;
}

export default function CreateTaskForm({ onClose, onTaskCreated, editingTask }: CreateTaskFormProps) {
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
  const [sendNotification, setSendNotification] = useState(true);
  const isEditMode = !!editingTask;

  // Populate form with editing data
  useEffect(() => {
    if (editingTask) {
      setFormData({
        name: editingTask.name || '',
        description: editingTask.description || '',
        amount: editingTask.amount.toString() || '',
        deadline: editingTask.deadline ? new Date(editingTask.deadline).toISOString().split('T')[0] : '',
        skills: editingTask.skills || []
      });
    } else {
      setFormData({
        name: '',
        description: '',
        amount: '',
        deadline: '',
        skills: []
      });
    }
  }, [editingTask]);

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

  const generateTaskId = async () => {
    const now = new Date();
    const yymmdd = now.getFullYear().toString().slice(-2) + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    
    // Query existing tasks for today to get the next sequence number
    const todayQuery = query(collection(db, 'tasks'));
    const todayTasks = await getDocs(todayQuery);
    
    // Filter tasks that have IDs starting with today's date
    const todayTaskIds = todayTasks.docs
      .map(doc => doc.id)
      .filter(id => id.startsWith(yymmdd))
      .map(id => {
        const sequence = id.split('-')[1];
        return sequence ? parseInt(sequence) : 0;
      })
      .filter(num => !isNaN(num));
    
    const nextSequence = todayTaskIds.length > 0 ? Math.max(...todayTaskIds) + 1 : 1;
    return `${yymmdd}-${nextSequence.toString().padStart(3, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setIsCreating(true);
      const now = new Date();
      
      if (isEditMode && editingTask) {
        // Update existing task
        const taskUpdates = {
          name: formData.name,
          description: formData.description,
          amount: parseFloat(formData.amount),
          deadline: Timestamp.fromDate(new Date(formData.deadline)),
          skills: formData.skills,
          updatedAt: Timestamp.fromDate(now),
          updatedBy: user.uid,
          updatedByName: user.fullname
        };

        await updateDoc(doc(db, 'tasks', editingTask.id), taskUpdates);
      } else {
        // Create new task
        const taskId = await generateTaskId();
        
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

        // Use the generated taskId as the document ID
        await setDoc(doc(db, 'tasks', taskId), newTask);

        // Send notifications to all users if enabled
        if (sendNotification) {
          try {
            const usersSnapshot = await getDocs(query(collection(db, 'users')));
            const allUsers = usersSnapshot.docs.map(doc => ({
              userId: doc.id,
              email: doc.data().email
            }));

            // Send notifications to all users
            await notificationService.notifyNewTask(formData.name, allUsers);
          } catch (notificationError) {
            console.warn('Failed to send new task notifications:', notificationError);
          }
        }
      }

      onTaskCreated?.();
      onClose();
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} task:`, error);
      alert(`Failed to ${isEditMode ? 'update' : 'create'} task. Please try again.`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-gray-900">
              {isEditMode ? 'Edit Tugasan' : 'Cipta Tugasan Baru'}
            </CardTitle>
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
                placeholder="8. Nota Tambahan&#10;Gunakan Bahasa Melayu sebagai bahasa utama&#10;&#10;Perlu mesra rakyat, inklusif dan sesuai untuk pelbagai lapisan masyarakat"
                className="w-full p-3 border border-gray-300 rounded-md resize-none h-32 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-relaxed"
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

            {!isEditMode && (
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                <input
                  type="checkbox"
                  id="sendNotification"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="sendNotification" className="text-sm font-medium text-gray-900">
                  Hantar pemberitahuan kepada semua pengguna
                </label>
              </div>
            )}

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
                {isCreating ? (isEditMode ? 'Mengemas kini...' : 'Mencipta...') : (isEditMode ? 'Kemas kini' : 'Cipta Tugasan')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}