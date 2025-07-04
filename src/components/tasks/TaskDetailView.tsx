'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Task, TaskStatus } from '@/types';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, FileText, Send } from 'lucide-react';

interface TaskDetailViewProps {
  task: Task;
  onBack: () => void;
  onUpdate?: (task: Task) => void;
}

export default function TaskDetailView({ task, onBack, onUpdate }: TaskDetailViewProps) {
  const { user } = useAuth();
  const [submissionNote, setSubmissionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || (task.status !== TaskStatus.IN_PROGRESS && task.status !== TaskStatus.NEEDS_REVISION)) return;

    setIsSubmitting(true);
    try {
      const now = new Date();
      const updates = {
        status: TaskStatus.SUBMITTED,
        submittedAt: Timestamp.fromDate(now),
        submissionNotes: submissionNote,
        submittedBy: {
          uid: user.uid,
          fullname: user.fullname,
          staffId: user.staffId
        }
      };

      await updateDoc(doc(db, 'tasks', task.id), updates);
      
      if (onUpdate) {
        onUpdate({ 
          ...task, 
          ...updates,
          submittedAt: now,
          status: TaskStatus.SUBMITTED 
        });
      }
    } catch (error) {
      console.error('Error submitting task:', error);
      alert('Gagal menghantar tugasan. Sila cuba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'bg-green-500 text-white';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-500 text-white';
      case TaskStatus.NEEDS_REVISION:
        return 'bg-red-500 text-white';
      case TaskStatus.SUBMITTED:
        return 'bg-purple-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getStatusText = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.NOT_STARTED:
        return 'Belum Dimulakan';
      case TaskStatus.IN_PROGRESS:
        return 'Sedang Dilaksanakan';
      case TaskStatus.SUBMITTED:
        return 'Telah Dihantar';
      case TaskStatus.NEEDS_REVISION:
        return 'Perlu Pembetulan';
      case TaskStatus.COMPLETED:
        return 'Selesai';
      default:
        return status;
    }
  };

  const canSubmitTask = () => {
    if (!user || !task.assignedTo) return false;
    if (user.uid !== task.assignedTo) return false;
    return task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.NEEDS_REVISION;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="sticky top-0 bg-white border-b z-10">
          <div className="flex items-start justify-between">
            <div>
              <Button variant="ghost" onClick={onBack} className="mb-2 text-gray-600">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
              <CardTitle className="text-2xl font-bold text-gray-900">Detail Tugasan</CardTitle>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 p-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nama Tugasan</h3>
            <p className="text-gray-700">{task.name}</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">ID Tugasan</h3>
            <p className="text-gray-700 font-mono">{task.id}</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Status</h3>
            <Badge className={`${getStatusColor(task.status)} px-4 py-1 text-sm font-medium rounded-full`}>
              {getStatusText(task.status)}
            </Badge>
          </div>

          {task.status === TaskStatus.NEEDS_REVISION && task.adminFeedback && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Maklum Balas Pembetulan</h3>
              <p className="text-red-700">{task.adminFeedback}</p>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Penerangan</h3>
            <p className="text-gray-700">{task.description}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Jumlah Bayaran</h3>
              <p className="text-gray-700 text-xl">{formatCurrency(task.amount)}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Tarikh Akhir</h3>
              <p className="text-gray-700 text-xl">{formatDate(task.deadline)}</p>
            </div>
          </div>

          {task.skills.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Kemahiran Diperlukan</h3>
              <div className="flex flex-wrap gap-2">
                {task.skills.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="bg-gray-200 text-gray-800 px-3 py-1">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {task.assignedToName && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ditugaskan kepada</h3>
              <p className="text-gray-700">{task.assignedToName} ({task.assignedToStaffId})</p>
            </div>
          )}

          {canSubmitTask() && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {task.status === TaskStatus.NEEDS_REVISION ? 'Hantar Semula Tugasan' : 'Hantar Tugasan'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nota Penyerahan {task.status === TaskStatus.NEEDS_REVISION ? '(Sila nyatakan pembetulan yang telah dibuat)' : '(Pilihan)'}
                  </label>
                  <Input
                    value={submissionNote}
                    onChange={(e) => setSubmissionNote(e.target.value)}
                    placeholder={task.status === TaskStatus.NEEDS_REVISION ? 
                      "Terangkan pembetulan yang telah anda lakukan..." : 
                      "Tambah nota atau komen untuk penyerahan ini..."}
                    className="w-full text-gray-900 bg-white border-gray-300"
                    required={task.status === TaskStatus.NEEDS_REVISION}
                  />
                </div>
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting || (task.status === TaskStatus.NEEDS_REVISION && !submissionNote.trim())}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Menghantar...' : task.status === TaskStatus.NEEDS_REVISION ? 'Hantar Semula' : 'Hantar Tugasan'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}