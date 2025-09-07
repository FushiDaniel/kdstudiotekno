'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Task, TaskStatus } from '@/types';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firebaseCache } from '@/lib/firebase-cache';
import { formatCurrency, formatDate, formatMessageWithLinks } from '@/lib/utils';
import { Clock, DollarSign, FileText, CheckCircle } from 'lucide-react';
import TaskDetailView from './TaskDetailView';
import Swal from 'sweetalert2';

export default function TaskView() {
  const { user } = useAuth();
  const [userTasks, setUserTasks] = useState<Task[]>([]);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [selectedView, setSelectedView] = useState<'my-tasks' | 'open-tasks'>('my-tasks');
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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
      default:
        return 'bg-gray-100 text-gray-800';
    }
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

  useEffect(() => {
    if (!user) return;

    // Use cached realtime listener for user's assigned tasks
    const userTasksUnsubscribe = firebaseCache.setupRealtimeListener<Task>(
      'tasks',
      (tasks) => {
        // Sort manually to avoid index requirement
        const sortedTasks = tasks.sort((a, b) => 
          b.createdAt.getTime() - a.createdAt.getTime()
        );
        
        setUserTasks(sortedTasks);
        setLoading(false);
        console.log(`📋 TaskView: Loaded ${sortedTasks.length} user tasks from cache/firestore`);
      },
      {
        where: [['assignedTo', '==', user.uid]]
      }
    );

    // Use cached realtime listener for open tasks
    const openTasksUnsubscribe = firebaseCache.setupRealtimeListener<Task>(
      'tasks',
      (tasks) => {
        // Filter out assigned tasks and sort manually
        const openTasks = tasks
          .filter(task => !task.assignedTo)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setOpenTasks(openTasks);
        console.log(`📋 TaskView: Loaded ${openTasks.length} open tasks from cache/firestore`);
      },
      {
        where: [['status', '==', TaskStatus.NOT_STARTED]]
      }
    );

    return () => {
      userTasksUnsubscribe();
      openTasksUnsubscribe();
    };
  }, [user]);

  const handleTakeTask = async (taskId: string) => {
    if (!user) return;

    // Check if user is Part Time - they cannot assign tasks to themselves
    if (user.staffId?.startsWith('PT')) {
      Swal.fire({
        icon: 'warning',
        title: 'Tidak Dibenarkan',
        text: 'Pekerja Part Time tidak dibenarkan mengambil tugasan sendiri. Sila hubungi admin untuk tugasan ditugaskan kepada anda.',
        confirmButtonColor: '#374151'
      });
      return;
    }

    // Find the task to check required skills
    const task = openTasks.find(t => t.id === taskId);
    if (!task) {
      Swal.fire({
        icon: 'error',
        title: 'Tugasan Tidak Dijumpai',
        text: 'Tugasan yang dipilih tidak dijumpai. Sila cuba lagi.',
        confirmButtonColor: '#374151'
      });
      return;
    }

    // If task has required skills, check if user has verified skills
    if (task.skills && task.skills.length > 0) {
      try {
        // Get user's verified skills
        const userSkillsQuery = query(
          collection(db, 'userSkills'),
          where('userId', '==', user.uid),
          where('verified', '==', true)
        );
        const userSkillsSnapshot = await getDocs(userSkillsQuery);
        const verifiedSkillNames = userSkillsSnapshot.docs.map(doc => doc.data().skillName);

        // Check if user has all required skills verified
        const missingSkills = task.skills.filter(requiredSkill => 
          !verifiedSkillNames.includes(requiredSkill)
        );

        if (missingSkills.length > 0) {
          // Show popup for unverified users
          const missingSkillsList = missingSkills.join(', ');
          Swal.fire({
            icon: 'warning',
            title: 'Kemahiran Belum Disahkan',
            html: `
              <p class="mb-3">Anda tidak mempunyai kemahiran yang disahkan untuk tugasan ini.</p>
              <div class="bg-gray-100 p-3 rounded-lg mb-3">
                <p class="font-semibold text-gray-700 mb-1">Kemahiran yang diperlukan:</p>
                <p class="text-gray-600">${missingSkillsList}</p>
              </div>
              <p class="text-sm text-gray-600">Sila hubungi admin untuk mengesahkan kemahiran anda terlebih dahulu.</p>
            `,
            confirmButtonColor: '#f59e0b',
            confirmButtonText: 'Faham'
          });
          return;
        }
      } catch (error) {
        console.error('Error checking user skills:', error);
        Swal.fire({
          icon: 'error',
          title: 'Ralat Berlaku',
          text: 'Ralat semasa memeriksa kemahiran. Sila cuba lagi.',
          confirmButtonColor: '#374151'
        });
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        assignedTo: user.uid,
        assignedToName: user.fullname,
        assignedToStaffId: user.staffId,
        assignedAt: Timestamp.fromDate(new Date()),
        status: TaskStatus.IN_PROGRESS,
        startDate: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error taking task:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  if (selectedTask) {
    return (
      <TaskDetailView 
        task={selectedTask} 
        onBack={() => setSelectedTask(null)}
        onUpdate={(updatedTask) => {
          setUserTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          setSelectedTask(updatedTask);
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Tugasan</h1>
        
        {/* Toggle Buttons */}
        <div className="flex space-x-2">
          <Button
            variant={selectedView === 'my-tasks' ? 'default' : 'outline'}
            onClick={() => setSelectedView('my-tasks')}
          >
            Tugasan Saya ({userTasks.length})
          </Button>
          <Button
            variant={selectedView === 'open-tasks' ? 'default' : 'outline'}
            onClick={() => setSelectedView('open-tasks')}
          >
            Tugasan Terbuka ({openTasks.length})
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {selectedView === 'my-tasks' ? (
          <>
            {userTasks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  Tiada tugasan yang diberikan kepada anda
                </CardContent>
              </Card>
            ) : (
              userTasks.map((task) => (
                <UserTaskCard 
                  key={task.id} 
                  task={task} 
                  onTaskSelect={setSelectedTask}
                  getStatusColor={getStatusColor}
                  getStatusBadge={getStatusBadge}
                />
              ))
            )}
          </>
        ) : (
          <>
            {openTasks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  Tiada tugasan terbuka pada masa ini
                </CardContent>
              </Card>
            ) : (
              openTasks.map((task) => (
                <OpenTaskCard 
                  key={task.id} 
                  task={task} 
                  onTakeTask={() => handleTakeTask(task.id)}
                  onTaskSelect={setSelectedTask}
                  getStatusColor={getStatusColor}
                  getStatusBadge={getStatusBadge}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface UserTaskCardProps {
  task: Task;
  onTaskSelect: (task: Task) => void;
  getStatusColor: (status: TaskStatus) => string;
  getStatusBadge: (status: TaskStatus) => string;
}

function UserTaskCard({ task, onTaskSelect, getStatusColor, getStatusBadge }: UserTaskCardProps) {
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
            <span className="truncate">Deadline: {formatDateTime(task.deadline)}</span>
          </div>
          <div className="flex items-center">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Status: {getStatusBadge(task.status)}</span>
          </div>
        </div>
        
        {/* Skills */}
        {task.skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {task.skills.map((skill, index) => (
              <Badge key={index} variant="secondary" className="text-xs px-2 py-1">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        {/* Action button */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => onTaskSelect(task)}
        >
          <FileText className="h-4 w-4 mr-2" />
          Lihat Detail
        </Button>
      </CardContent>
    </Card>
  );
}

interface OpenTaskCardProps {
  task: Task;
  onTakeTask: () => void;
  onTaskSelect: (task: Task) => void;
  getStatusColor: (status: TaskStatus) => string;
  getStatusBadge: (status: TaskStatus) => string;
}

function OpenTaskCard({ task, onTakeTask, onTaskSelect, getStatusColor, getStatusBadge }: OpenTaskCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
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
            <span className="truncate">Deadline: {formatDateTime(task.deadline)}</span>
          </div>
          <div className="flex items-center">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Status: {getStatusBadge(task.status)}</span>
          </div>
        </div>
        
        {/* Skills */}
        {task.skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {task.skills.map((skill, index) => (
              <Badge key={index} variant="secondary" className="text-xs px-2 py-1">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            className="flex-1 w-full"
            onClick={() => onTaskSelect(task)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Lihat Detail
          </Button>
          <Button 
            className="flex-1 w-full"
            onClick={onTakeTask}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Ambil Tugasan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
