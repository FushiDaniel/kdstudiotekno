'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Task, TaskStatus, TaskPaymentStatus, TaskMessage, User } from '@/types';
import { collection, query, onSnapshot, doc, updateDoc, where, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firebaseCache } from '@/lib/firebase-cache';
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
    // Use cached realtime listener for tasks
    const unsubscribe = firebaseCache.setupRealtimeListener<Task>(
      'tasks',
      (allTasks) => {
        // Sort tasks: admin approval needed first, then by created date
        const sortedTasks = allTasks.sort((a, b) => {
          // Tasks that need admin approval (SUBMITTED status) come first
          const aNeedsApproval = a.status === 'SUBMITTED';
          const bNeedsApproval = b.status === 'SUBMITTED';
          
          if (aNeedsApproval && !bNeedsApproval) return -1;
          if (!aNeedsApproval && bNeedsApproval) return 1;
          
          // Then sort by created date (newest first)
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        setTasks(sortedTasks);
        setLoading(false);
        console.log(`📋 AdminTaskView: Loaded ${sortedTasks.length} tasks from cache/firestore`);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch users for assignment with caching
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await firebaseCache.getCachedCollection<User>('users', {
          where: [['isApproved', '==', true]]
        });
        
        setUsers(allUsers.filter(u => !u.isAdmin)); // Only approved non-admin users
        console.log(`👥 AdminTaskView: Loaded ${allUsers.length} users from cache/firestore`);
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
        try {
          // Get the actual user email from users collection
          const userQuery = query(collection(db, 'users'), where('uid', '==', selectedTask.assignedTo));
          const userSnapshot = await getDocs(userQuery);
          const userDoc = userSnapshot.docs[0];
          const userEmail = userDoc ? userDoc.data().email : null;
          
          console.log('Sending notification for task status:', status, 'to user:', selectedTask.assignedTo, 'email:', userEmail);
          
          if (userEmail) {
            if (status === TaskStatus.COMPLETED) {
              console.log('Sending task approved notification');
              await notificationService.notifyTaskApproved(
                selectedTask.assignedTo,
                userEmail,
                selectedTask.name,
                formatCurrency(selectedTask.amount),
                selectedTask.id
              );
            } else if (status === TaskStatus.NEEDS_REVISION) {
              console.log('Sending task rejected notification for pembetulan');
              await notificationService.notifyTaskRejected(
                selectedTask.assignedTo,
                userEmail,
                selectedTask.name,
                feedbackNote || 'Sila semak komen admin.',
                selectedTask.id
              );
            }
          } else {
            console.error('User email not found for notification. User ID:', selectedTask.assignedTo);
          }
        } catch (notificationError) {
          console.error('Error sending notification to user:', notificationError);
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
    console.log('handleAssignTask called', { taskToAssign, assignedUserId, user });
    
    if (!taskToAssign) {
      console.error('No task to assign');
      alert('Tiada tugasan untuk ditugaskan.');
      return;
    }
    
    if (!assignedUserId) {
      console.error('No user selected');
      alert('Sila pilih pengguna untuk ditugaskan.');
      return;
    }
    
    if (!user) {
      console.error('No current user');
      alert('Pengguna semasa tidak dijumpai.');
      return;
    }

    setIsAssigning(true);
    try {
      const assignedUser = users.find(u => u.staffId === assignedUserId);
      
      if (!assignedUser) {
        console.error('Selected user not found in users list');
        alert('Pengguna yang dipilih tidak dijumpai.');
        setIsAssigning(false);
        return;
      }

      const now = new Date();
      const updates = {
        assignedTo: assignedUser.uid || (assignedUser as any).id,
        assignedToName: assignedUser.fullname,
        assignedToStaffId: assignedUser.staffId,
        assignedAt: Timestamp.fromDate(now),
        status: TaskStatus.IN_PROGRESS,
        startDate: Timestamp.fromDate(now)
      };

      await updateDoc(doc(db, 'tasks', taskToAssign.id), updates);
      
      // Send notification to the assigned user
      try {
        if (assignedUser.email) {
          await notificationService.notifyTaskAssigned(
            assignedUser.uid || (assignedUser as any).id,
            assignedUser.email,
            taskToAssign.name,
            taskToAssign.deadline ? (taskToAssign.deadline instanceof Date ? taskToAssign.deadline.toLocaleDateString('ms-MY') : new Date((taskToAssign.deadline as any).toDate()).toLocaleDateString('ms-MY')) : 'Tiada',
            taskToAssign.id
          );
        }
      } catch (notificationError) {
        console.warn('Failed to send assignment notification:', notificationError);
      }
      
      // Update local state
      setTasks(prev => prev.map(t => t.id === taskToAssign.id ? { ...t, ...updates, assignedAt: now, startDate: now } : t));
      
      // Close modal and reset state
      setShowAssignModal(false);
      setTaskToAssign(null);
      setAssignedUserId('');
      
      console.log(`Task assigned successfully to ${assignedUser.fullname}`);
      alert(`Tugasan berjaya ditugaskan kepada ${assignedUser.fullname}`);
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
                      <option key={user.uid} value={user.staffId}>
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
                    onClick={() => {
                      console.log('Tugaskan button clicked', { assignedUserId, isAssigning });
                      handleAssignTask();
                    }}
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
    <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 break-words text-sm sm:text-base">{task.name}</h3>
            <p className="text-xs sm:text-sm text-gray-600 font-mono break-all">ID: {task.id}</p>
          </div>
          <div className="text-left sm:text-right flex-shrink-0">
            <div className="text-lg sm:text-xl font-bold">{formatCurrency(task.amount)}</div>
            <div className="flex flex-wrap gap-2 sm:justify-end mt-2">
              <Badge className={`${getStatusColor(task.status)} text-xs`}>
                {getStatusBadge(task.status)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          <div className="text-gray-700 text-sm leading-relaxed break-words max-h-20 overflow-y-auto">
            {formatMessageWithLinks(task.description)}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-4">
          <div className="flex items-center">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Deadline: {formatDate(task.deadline)}</span>
          </div>
          <div className="flex items-center">
            <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
            <span className="truncate">{task.assignedToName || 'Belum ditugaskan'}</span>
          </div>
        </div>
        
        {/* Skills */}
        {task.skills?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {task.skills.map((skill, index) => (
              <Badge key={index} variant="secondary" className="text-xs px-2 py-1">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        {/* Action buttons - Mobile responsive with proper wrapping */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1 min-w-[120px] text-gray-900 border-gray-300"
            onClick={onViewDetail}
          >
            <FileText className="h-4 w-4 mr-2" />
            Detail
          </Button>
          
          {canEditOrDelete(task) && (
            <>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => onEditTask(task)}
                className="flex-1 min-w-[120px] text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => onDeleteTask(task)}
                className="flex-1 min-w-[120px] text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Padam
              </Button>
            </>
          )}
          
          {!task.assignedTo && (
            <Button 
              onClick={() => onAssignTask(task)}
              className="flex-1 min-w-[120px] bg-purple-600 hover:bg-purple-700 text-white"
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Tugaskan
            </Button>
          )}
          {task.status === TaskStatus.SUBMITTED && (
            <Button 
              className="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
              onClick={onViewDetail}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Semak
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}