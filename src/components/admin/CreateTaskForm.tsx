'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Task, TaskStatus, TaskPaymentStatus, Skill, User } from '@/types';
import { collection, addDoc, Timestamp, getDocs, query, setDoc, doc, updateDoc, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firebaseCache } from '@/lib/firebase-cache';
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
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [notificationType, setNotificationType] = useState<'all' | 'skilled'>('all');
  const [sendNotification, setSendNotification] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [assignToUser, setAssignToUser] = useState<string>('');
  const isEditMode = !!editingTask;

  // Load available skills
  useEffect(() => {
    const skillsQuery = query(collection(db, 'skills'));
    const unsubscribe = onSnapshot(skillsQuery, (snapshot) => {
      const skills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Skill[];
      setAvailableSkills(skills);
    });

    return unsubscribe;
  }, []);

  // Load users for assignment
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await firebaseCache.getCachedCollection<User>('users', {
          where: [['isApproved', '==', true]]
        });
        
        setUsers(allUsers.filter(u => !u.isAdmin)); // Only approved non-admin users
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

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

  const handleAddSkill = (skillId: string) => {
    const skill = availableSkills.find(s => s.id === skillId);
    if (skill && !formData.skills.includes(skill.name)) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skill.name]
      }));
      setSelectedSkillId('');
      setShowSkillDropdown(false);
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const getUnselectedSkills = () => {
    return availableSkills.filter(skill => !formData.skills.includes(skill.name));
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
        
        // Handle direct assignment
        const assignedUser = assignToUser ? users.find(u => u.staffId === assignToUser) : null;
        const isDirectlyAssigned = !!assignedUser;
        
        const newTask = {
          name: formData.name,
          description: formData.description,
          amount: parseFloat(formData.amount),
          deadline: Timestamp.fromDate(new Date(formData.deadline)),
          skills: formData.skills,
          status: isDirectlyAssigned ? TaskStatus.IN_PROGRESS : TaskStatus.NOT_STARTED,
          paymentStatus: TaskPaymentStatus.NOT_STARTED,
          createdBy: user.uid,
          createdByName: user.fullname,
          createdAt: Timestamp.fromDate(now),
          ...(isDirectlyAssigned && assignedUser ? {
            assignedTo: assignedUser.uid || (assignedUser as any).id,
            assignedToName: assignedUser.fullname,
            assignedToStaffId: assignedUser.staffId,
            assignedAt: Timestamp.fromDate(now),
            startDate: Timestamp.fromDate(now)
          } : {
            assignedTo: null,
            assignedToName: null,
            assignedToStaffId: null,
            assignedAt: null,
            startDate: null
          })
        };

        // Use the generated taskId as the document ID
        await setDoc(doc(db, 'tasks', taskId), newTask);

        // Send notifications based on assignment type
        if (isDirectlyAssigned && assignedUser) {
          // If directly assigned, only notify the assigned user
          try {
            if (assignedUser.email) {
              await notificationService.notifyTaskAssigned(
                assignedUser.uid || (assignedUser as any).id,
                assignedUser.email,
                formData.name,
                new Date(formData.deadline).toLocaleDateString('ms-MY'),
                taskId
              );
            }
          } catch (notificationError) {
            console.warn('Failed to send assignment notification:', notificationError);
          }
        } else if (sendNotification) {
          // If not directly assigned, send notifications based on type
          try {
            let targetUsers: {userId: string; email: string}[] = [];

            if (notificationType === 'all') {
              // Notify all users
              const usersSnapshot = await getDocs(query(collection(db, 'users')));
              targetUsers = usersSnapshot.docs.map(doc => ({
                userId: doc.id,
                email: doc.data().email
              }));
            } else if (notificationType === 'skilled' && formData.skills.length > 0) {
              // Notify only users with required skills
              const userSkillsSnapshot = await getDocs(query(
                collection(db, 'userSkills'),
                where('skillName', 'in', formData.skills)
              ));
              
              const userIds = [...new Set(userSkillsSnapshot.docs.map(doc => doc.data().userId))];
              
              if (userIds.length > 0) {
                const usersSnapshot = await getDocs(query(
                  collection(db, 'users'),
                  where('__name__', 'in', userIds)
                ));
                
                targetUsers = usersSnapshot.docs.map(doc => ({
                  userId: doc.id,
                  email: doc.data().email
                }));
              }
            }

            if (targetUsers.length > 0) {
              await notificationService.notifyNewTask(formData.name, targetUsers);
            }
          } catch (notificationError) {
            console.warn('Failed to send new task notifications:', notificationError);
          }
        }
      }

      onTaskCreated?.();
      onClose();
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} task:`, error);
      alert(`Gagal ${isEditMode ? 'mengemaskini' : 'mencipta'} tugasan. Sila cuba lagi.`);
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
              <div className="mb-2">
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSkillDropdown(!showSkillDropdown)}
                    className="w-full justify-start bg-white text-gray-900 border-gray-300"
                    disabled={getUnselectedSkills().length === 0}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {getUnselectedSkills().length === 0 
                      ? 'Semua kemahiran telah ditambah' 
                      : 'Pilih Kemahiran'
                    }
                  </Button>

                  {showSkillDropdown && getUnselectedSkills().length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {getUnselectedSkills().map(skill => (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => handleAddSkill(skill.id)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{skill.name}</div>
                            {skill.description && (
                              <div className="text-sm text-gray-500">{skill.description}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Tugaskan Kepada Pengguna (Pilihan)
                </label>
                <select
                  value={assignToUser}
                  onChange={(e) => setAssignToUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tidak tugaskan - biarkan terbuka untuk diambil</option>
                  {users.map(user => (
                    <option key={user.uid} value={user.staffId}>
                      {user.fullname} ({user.staffId}) - {user.employmentType}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Jika ditugaskan terus, hanya pengguna yang ditugaskan akan menerima pemberitahuan
                </p>
              </div>
            )}

            {!isEditMode && assignToUser && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800 font-medium">
                  ✓ Pemberitahuan dimatikan - hanya pengguna yang ditugaskan akan menerima pemberitahuan
                </p>
              </div>
            )}

            {!isEditMode && !assignToUser && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-md">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="sendNotification"
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label htmlFor="sendNotification" className="text-sm font-medium text-gray-900">
                    Hantar pemberitahuan
                  </label>
                </div>
                
                {sendNotification && (
                  <div className="ml-6 space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="notifyAll"
                        name="notificationType"
                        value="all"
                        checked={notificationType === 'all'}
                        onChange={(e) => setNotificationType(e.target.value as 'all' | 'skilled')}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                      />
                      <label htmlFor="notifyAll" className="text-sm text-gray-700">
                        Kepada semua pengguna
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="notifySkilled"
                        name="notificationType"
                        value="skilled"
                        checked={notificationType === 'skilled'}
                        onChange={(e) => setNotificationType(e.target.value as 'all' | 'skilled')}
                        disabled={formData.skills.length === 0}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
                      />
                      <label htmlFor="notifySkilled" className={`text-sm ${formData.skills.length === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                        Hanya kepada pengguna dengan kemahiran yang dipilih
                        {formData.skills.length === 0 && ' (Pilih kemahiran terlebih dahulu)'}
                      </label>
                    </div>
                  </div>
                )}
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