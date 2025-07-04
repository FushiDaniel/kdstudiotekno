'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Task, TaskStatus } from '@/types';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Search, DollarSign, Clock, Users, X, CheckCircle, FileText } from 'lucide-react';
import CreateTaskForm from './CreateTaskForm';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminTaskView() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | TaskStatus>('all');
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');

  useEffect(() => {
    // Simple query without orderBy to avoid index requirement
    const q = query(collection(db, 'tasks'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        deadline: doc.data().deadline?.toDate(),
        assignedAt: doc.data().assignedAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate(),
        submittedAt: doc.data().submittedAt?.toDate(),
        startDate: doc.data().startDate?.toDate(),
      })) as Task[];
      
      // Sort manually to avoid index requirement
      const sortedTasks = allTasks.sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      setTasks(sortedTasks);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching tasks:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || task.status === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const taskCounts = {
    all: tasks.length,
    [TaskStatus.NOT_STARTED]: tasks.filter(t => t.status === TaskStatus.NOT_STARTED).length,
    [TaskStatus.IN_PROGRESS]: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
    [TaskStatus.SUBMITTED]: tasks.filter(t => t.status === TaskStatus.SUBMITTED).length,
    [TaskStatus.NEEDS_REVISION]: tasks.filter(t => t.status === TaskStatus.NEEDS_REVISION).length,
    [TaskStatus.COMPLETED]: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'Selesai';
      case TaskStatus.IN_PROGRESS:
        return 'Sedang Dilaksanakan';
      case TaskStatus.NEEDS_REVISION:
        return 'Perlu Pembetulan';
      case TaskStatus.SUBMITTED:
        return 'Menunggu Semakan';
      case TaskStatus.NOT_STARTED:
        return 'Belum Dimulakan';
      default:
        return status;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      case TaskStatus.NEEDS_REVISION:
        return 'bg-red-100 text-red-800';
      case TaskStatus.SUBMITTED:
        return 'bg-purple-100 text-purple-800';
      case TaskStatus.NOT_STARTED:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleTaskReview = async (status: TaskStatus.COMPLETED | TaskStatus.NEEDS_REVISION) => {
    if (!selectedTask || !user) return;

    setIsUpdating(true);
    try {
      const now = new Date();
      const updates = {
        status,
        adminFeedback: feedbackNote,
        reviewedAt: Timestamp.fromDate(now),
        reviewedBy: {
          uid: user.uid,
          fullname: user.fullname,
          staffId: user.staffId
        }
      };

      await updateDoc(doc(db, 'tasks', selectedTask.id), updates);
      
      const updatedTask = { 
        ...selectedTask, 
        ...updates,
        reviewedAt: now // Convert Timestamp to Date for local state
      };
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      setSelectedTask(null);
      setFeedbackNote('');
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin - Urus Tugasan</h1>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Cipta Tugasan Baru
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari tugasan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter('all')}
          >
            Semua ({taskCounts.all})
          </Button>
          <Button
            variant={selectedFilter === TaskStatus.NOT_STARTED ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter(TaskStatus.NOT_STARTED)}
          >
            Belum Dimulakan ({taskCounts[TaskStatus.NOT_STARTED]})
          </Button>
          <Button
            variant={selectedFilter === TaskStatus.IN_PROGRESS ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter(TaskStatus.IN_PROGRESS)}
          >
            Sedang Dilaksanakan ({taskCounts[TaskStatus.IN_PROGRESS]})
          </Button>
          <Button
            variant={selectedFilter === TaskStatus.SUBMITTED ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter(TaskStatus.SUBMITTED)}
          >
            Menunggu Semakan ({taskCounts[TaskStatus.SUBMITTED]})
          </Button>
          <Button
            variant={selectedFilter === TaskStatus.NEEDS_REVISION ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter(TaskStatus.NEEDS_REVISION)}
          >
            Perlu Pembetulan ({taskCounts[TaskStatus.NEEDS_REVISION]})
          </Button>
          <Button
            variant={selectedFilter === TaskStatus.COMPLETED ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter(TaskStatus.COMPLETED)}
          >
            Selesai ({taskCounts[TaskStatus.COMPLETED]})
          </Button>
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="space-y-6">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              {searchTerm ? 
                `Tiada tugasan ditemui untuk "${searchTerm}"` : 
                'Tiada tugasan'
              }
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <AdminTaskCard 
              key={task.id} 
              task={task} 
              onViewDetail={() => setSelectedTask(task)}
              onTaskUpdated={(updatedTask) => {
                setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                setSelectedTask(updatedTask);
              }}
            />
          ))
        )}
      </div>

      {/* Create Task Form */}
      {showCreateForm && (
        <CreateTaskForm 
          onClose={() => setShowCreateForm(false)}
          onTaskCreated={() => {
            // Tasks will be updated automatically via real-time listener
          }}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
            <CardHeader className="sticky top-0 bg-white border-b z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-gray-900">Detail Tugasan</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setSelectedTask(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nama Tugasan</h3>
                <p className="text-gray-700">{selectedTask.name}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">ID Tugasan</h3>
                <p className="text-gray-700 font-mono">{selectedTask.id}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Status</h3>
                <Badge className={`${getStatusColor(selectedTask.status)} px-4 py-1 text-sm font-medium rounded-full`}>
                  {getStatusBadge(selectedTask.status)}
                </Badge>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Penerangan</h3>
                <p className="text-gray-700">{selectedTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Jumlah Bayaran</h3>
                  <p className="text-gray-700">{formatCurrency(selectedTask.amount)}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Tarikh Akhir</h3>
                  <p className="text-gray-700">{formatDate(selectedTask.deadline)}</p>
                </div>
              </div>

              {selectedTask.assignedToName && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Ditugaskan Kepada</h3>
                  <p className="text-gray-700">
                    {selectedTask.assignedToName} ({selectedTask.assignedToStaffId})
                  </p>
                </div>
              )}

              {selectedTask.skills?.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Kemahiran Diperlukan</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-800">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.submissionNotes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nota Penyerahan</h3>
                  <p className="text-gray-700">{selectedTask.submissionNotes}</p>
                </div>
              )}

              {selectedTask.status === TaskStatus.SUBMITTED && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Semakan Admin</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nota Maklum Balas (Pilihan)
                      </label>
                      <Input
                        value={feedbackNote}
                        onChange={(e) => setFeedbackNote(e.target.value)}
                        placeholder="Tambah nota atau komen untuk maklum balas..."
                        className="w-full text-gray-900 bg-white border-gray-300"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        onClick={() => handleTaskReview(TaskStatus.COMPLETED)}
                        disabled={isUpdating}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {isUpdating ? 'Mengemaskini...' : 'Terima Tugasan'}
                      </Button>
                      <Button 
                        onClick={() => handleTaskReview(TaskStatus.NEEDS_REVISION)}
                        disabled={isUpdating}
                        variant="destructive"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {isUpdating ? 'Mengemaskini...' : 'Perlu Pembetulan'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface AdminTaskCardProps {
  task: Task;
  onViewDetail: () => void;
  onTaskUpdated: (task: Task) => void;
}

function AdminTaskCard({ task, onViewDetail }: AdminTaskCardProps) {
  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'Selesai';
      case TaskStatus.IN_PROGRESS:
        return 'Sedang Dilaksanakan';
      case TaskStatus.NEEDS_REVISION:
        return 'Perlu Pembetulan';
      case TaskStatus.SUBMITTED:
        return 'Menunggu Semakan';
      case TaskStatus.NOT_STARTED:
        return 'Belum Dimulakan';
      default:
        return status;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      case TaskStatus.NEEDS_REVISION:
        return 'bg-red-100 text-red-800';
      case TaskStatus.SUBMITTED:
        return 'bg-purple-100 text-purple-800';
      case TaskStatus.NOT_STARTED:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow border border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg text-gray-900">{task.name}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">ID: {task.id}</p>
          </div>
          <Badge className={getStatusColor(task.status)}>
            {getStatusBadge(task.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-gray-600 mb-6">{task.description}</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center text-sm text-gray-900">
            <DollarSign className="h-4 w-4 mr-2 text-gray-500" />
            <span className="font-medium">RM {task.amount.toFixed(2)}</span>
          </div>
          <div className="flex items-center text-sm text-gray-900">
            <Clock className="h-4 w-4 mr-2 text-gray-500" />
            <span>{formatDate(task.deadline)}</span>
          </div>
          <div className="flex items-center text-sm text-gray-900">
            <Users className="h-4 w-4 mr-2 text-gray-500" />
            <span>{task.assignedToName || 'Belum ditugaskan'}</span>
          </div>
          <div className="text-sm text-gray-900">
            <span className="text-gray-500">Dicipta:</span> {formatDate(task.createdAt)}
          </div>
        </div>

        {task.skills?.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-2">Kemahiran Diperlukan:</p>
            <div className="flex flex-wrap gap-2">
              {task.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-800">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-2">
          <Button 
            variant="outline" 
            className="text-gray-900 border-gray-300"
            onClick={onViewDetail}
          >
            Lihat Detail
          </Button>
          {task.status === TaskStatus.SUBMITTED && (
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={onViewDetail}
            >
              Semak Tugasan
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}