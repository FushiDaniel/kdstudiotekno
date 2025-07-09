'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Task, TaskStatus, TaskPaymentStatus, TaskMessage, User } from '@/types';
import { collection, query, onSnapshot, doc, updateDoc, where, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, formatDate, formatMessageWithLinks } from '@/lib/utils';
import { Plus, Search, DollarSign, Clock, Users, X, CheckCircle, FileText, MessageCircle, Send, UserPlus, Edit, Trash2 } from 'lucide-react';
import CreateTaskForm from './CreateTaskForm';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { notificationService } from '@/lib/notifications';

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
  const [adjustedAmount, setAdjustedAmount] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [taskToAssign, setTaskToAssign] = useState<Task | null>(null);
  const [assignedUserId, setAssignedUserId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Fetch users for assignment
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const allUsers = usersSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date()
        })) as User[];
        
        setUsers(allUsers.filter(u => !u.isAdmin && u.isApproved)); // Only approved non-admin users
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

  // Listen for messages when a task is selected
  useEffect(() => {
    if (!selectedTask?.id) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'taskMessages'),
      where('taskId', '==', selectedTask.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as TaskMessage[];
      
      // Sort manually to avoid index requirement
      const sortedMessages = taskMessages.sort((a, b) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );
      
      setMessages(sortedMessages);
    });

    return () => unsubscribe();
  }, [selectedTask?.id]);

  const handleSendMessage = async () => {
    if (!user || !newMessage.trim() || !selectedTask) return;

    setIsSendingMessage(true);
    try {
      await addDoc(collection(db, 'taskMessages'), {
        taskId: selectedTask.id,
        senderId: user.uid,
        senderName: user.fullname,
        message: newMessage.trim(),
        timestamp: Timestamp.fromDate(new Date())
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Gagal menghantar mesej. Sila cuba lagi.');
    } finally {
      setIsSendingMessage(false);
    }
  };

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
      const finalAmount = adjustedAmount !== null ? adjustedAmount : selectedTask.amount;
      const updates = {
        status,
        adminFeedback: feedbackNote,
        amount: finalAmount,
        originalAmount: selectedTask.amount,
        reviewedAt: Timestamp.fromDate(now),
        reviewedBy: {
          uid: user.uid,
          fullname: user.fullname,
          staffId: user.staffId
        },
        // Set payment status to PENDING when task is approved
        ...(status === TaskStatus.COMPLETED && {
          paymentStatus: TaskPaymentStatus.PENDING
        })
      };

      await updateDoc(doc(db, 'tasks', selectedTask.id), updates);
      
      const updatedTask = { 
        ...selectedTask, 
        ...updates,
        reviewedAt: now // Convert Timestamp to Date for local state
      };
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));

      // Send notification to the task assignee
      if (selectedTask.assignedTo) {
        // Get user email - in a real app, you'd fetch this from users collection
        const userEmail = selectedTask.assignedToName ? `${selectedTask.assignedToName.toLowerCase().replace(' ', '')}@email.com` : 'user@email.com';
        
        if (status === TaskStatus.COMPLETED) {
          await notificationService.notifyTaskApproved(
            selectedTask.assignedTo,
            userEmail,
            selectedTask.name,
            formatCurrency(selectedTask.amount),
            selectedTask.id
          );
        } else {
          await notificationService.notifyTaskRejected(
            selectedTask.assignedTo,
            userEmail,
            selectedTask.name,
            feedbackNote || 'Sila semak komen admin.',
            selectedTask.id
          );
        }
      }
      
      setSelectedTask(null);
      setFeedbackNote('');
      setAdjustedAmount(null);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignTask = async () => {
    if (!taskToAssign || !assignedUserId || !user) return;

    setIsAssigning(true);
    try {
      const assignedUser = users.find(u => u.uid === assignedUserId);
      if (!assignedUser) return;

      const now = new Date();
      const updates = {
        assignedTo: assignedUserId,
        assignedToName: assignedUser.fullname,
        assignedToStaffId: assignedUser.staffId,
        assignedAt: Timestamp.fromDate(now),
        status: TaskStatus.IN_PROGRESS,
        startDate: Timestamp.fromDate(now)
      };

      await updateDoc(doc(db, 'tasks', taskToAssign.id), updates);
      
      // Update local state
      setTasks(prev => prev.map(t => t.id === taskToAssign.id ? { ...t, ...updates, assignedAt: now, startDate: now } : t));
      
      // Close modal and reset state
      setShowAssignModal(false);
      setTaskToAssign(null);
      setAssignedUserId('');
      
      console.log(`Task assigned to ${assignedUser.fullname}`);
    } catch (error) {
      console.error('Error assigning task:', error);
      alert('Gagal menugaskan. Sila cuba lagi.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'tasks', taskToDelete.id));
      
      // Update local state
      setTasks(prev => prev.filter(t => t.id !== taskToDelete.id));
      
      // Close modal and reset state
      setShowDeleteConfirm(false);
      setTaskToDelete(null);
      
      console.log(`Task ${taskToDelete.id} deleted`);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Gagal memadamkan tugasan. Sila cuba lagi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const canEditOrDelete = (task: Task) => {
    return task.status === TaskStatus.NOT_STARTED && !task.assignedTo;
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowCreateForm(true);
  };

  const handleDeleteConfirm = (task: Task) => {
    setTaskToDelete(task);
    setShowDeleteConfirm(true);
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
              onViewDetail={() => {
                setSelectedTask(task);
                setAdjustedAmount(null);
              }}
              onAssignTask={(task) => {
                setTaskToAssign(task);
                setShowAssignModal(true);
              }}
              onTaskUpdated={(updatedTask) => {
                setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                setSelectedTask(updatedTask);
                setAdjustedAmount(null);
              }}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteConfirm}
              canEditOrDelete={canEditOrDelete}
            />
          ))
        )}
      </div>

      {/* Create Task Form */}
      {showCreateForm && (
        <CreateTaskForm 
          onClose={() => {
            setShowCreateForm(false);
            setEditingTask(null);
          }}
          onTaskCreated={() => {
            // Tasks will be updated automatically via real-time listener
            setEditingTask(null);
          }}
          editingTask={editingTask}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
            <CardHeader className="sticky top-0 bg-white border-b z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-gray-900">Detail Tugasan</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowChat(!showChat)}
                    className="flex items-center gap-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Chat
                    {messages.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {messages.length}
                      </Badge>
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedTask(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {showChat && (
                <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Chat Tugasan
                  </h3>
                  
                  <div className="space-y-4 mb-4 max-h-60 overflow-y-auto">
                    {messages.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        Belum ada mesej. Mulakan perbualan!
                      </p>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg break-words ${
                              message.senderId === user?.uid
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-800'
                            }`}
                          >
                            <p className="text-sm font-medium mb-1">{message.senderName}</p>
                            <div className="text-sm">{formatMessageWithLinks(message.message)}</div>
                            <p className="text-xs opacity-75 mt-1">
                              {message.timestamp.toLocaleTimeString('ms-MY', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Taip mesej anda..."
                      className="flex-1"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || isSendingMessage}
                      size="sm"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

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
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed font-sans">
                    {formatMessageWithLinks(selectedTask.description)}
                  </div>
                </div>
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
                  <div className="text-gray-700">{formatMessageWithLinks(selectedTask.submissionNotes)}</div>
                </div>
              )}

              {selectedTask.status === TaskStatus.SUBMITTED && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Semakan Admin</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Jumlah Bayaran Asal
                        </label>
                        <div className="p-3 bg-gray-50 border border-gray-300 rounded-md text-gray-900">
                          {formatCurrency(selectedTask.amount)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Laraskan Jumlah Bayaran (Pilihan)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={adjustedAmount !== null ? adjustedAmount : ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setAdjustedAmount(value === '' ? null : parseFloat(value));
                          }}
                          placeholder={`Asal: ${formatCurrency(selectedTask.amount)}`}
                          className="w-full text-gray-900 bg-white border-gray-300"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Kosongkan untuk menggunakan jumlah asal
                        </p>
                      </div>
                    </div>
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
                    {adjustedAmount !== null && adjustedAmount !== selectedTask.amount && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          <strong>Amaran:</strong> Jumlah bayaran akan diubah dari {formatCurrency(selectedTask.amount)} kepada {formatCurrency(adjustedAmount)}.
                        </p>
                      </div>
                    )}
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

      {/* Task Assignment Modal */}
      {showAssignModal && taskToAssign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold text-gray-900">Tugaskan Kepada Pengguna</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowAssignModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Tugasan:</h3>
                  <p className="text-sm text-gray-600">{taskToAssign.name}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Pengguna *
                  </label>
                  <select
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Pilih pengguna...</option>
                    {users.map(user => (
                      <option key={user.uid} value={user.uid}>
                        {user.fullname} ({user.staffId}) - {user.employmentType}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowAssignModal(false)}
                    className="flex-1"
                  >
                    Batal
                  </Button>
                  <Button 
                    onClick={handleAssignTask}
                    disabled={!assignedUserId || isAssigning}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {isAssigning ? 'Menugaskan...' : 'Tugaskan'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && taskToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-900">
                Padam Tugasan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Adakah anda pasti ingin memadamkan tugasan ini?
              </p>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-900">{taskToDelete.name}</p>
                <p className="text-sm text-gray-600">ID: {taskToDelete.id}</p>
              </div>
              <p className="text-sm text-red-600">
                Tindakan ini tidak boleh dibatalkan.
              </p>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setTaskToDelete(null);
                  }}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  onClick={handleDeleteTask}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? 'Memadamkan...' : 'Padam'}
                </Button>
              </div>
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
  onAssignTask: (task: Task) => void;
  onTaskUpdated: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  canEditOrDelete: (task: Task) => boolean;
}

function AdminTaskCard({ task, onViewDetail, onAssignTask, onEditTask, onDeleteTask, canEditOrDelete }: AdminTaskCardProps) {
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
          
          {canEditOrDelete(task) && (
            <>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => onEditTask(task)}
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => onDeleteTask(task)}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Padam
              </Button>
            </>
          )}
          
          {!task.assignedTo && task.status === TaskStatus.NOT_STARTED && (
            <Button 
              onClick={() => onAssignTask(task)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Tugaskan
            </Button>
          )}
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