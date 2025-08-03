'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, momentLocalizer, View, Event } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ms'; // Malay locale
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Task, CalendarEvent, CalendarEventType, TaskStatus } from '@/types';
import { collection, query, onSnapshot, addDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDate } from '@/lib/utils';
import { Plus, Eye, Calendar as CalendarIcon, Users, Clock } from 'lucide-react';
import { notificationService } from '@/lib/notifications';
import EventDetailModal from './EventDetailModal';
import CreateEventModal from './CreateEventModal';
import { CalendarEventExtended } from './types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Set moment to Malay locale and create localizer
moment.locale('ms');
const localizer = momentLocalizer(moment);

export default function CalendarView() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [currentView, setCurrentView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventExtended | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper functions
  const getEventIcon = (type: CalendarEventType) => {
    switch (type) {
      case CalendarEventType.MEETING:
        return '👥';
      case CalendarEventType.DEADLINE:
        return '⏰';
      case CalendarEventType.TASK:
        return '📋';
      case CalendarEventType.TRAINING:
        return '🎓';
      case CalendarEventType.WORKSHOP:
        return '🛠️';
      case CalendarEventType.REVIEW:
        return '🔍';
      case CalendarEventType.PRESENTATION:
        return '📊';
      case CalendarEventType.CLIENT_MEETING:
        return '🤝';
      case CalendarEventType.TEAM_BUILDING:
        return '🎯';
      case CalendarEventType.ANNOUNCEMENT:
        return '📢';
      default:
        return '📅';
    }
  };

  const getEventColor = (type: CalendarEventType) => {
    switch (type) {
      case CalendarEventType.MEETING:
        return '#8b5cf6';
      case CalendarEventType.DEADLINE:
        return '#ef4444';
      case CalendarEventType.TASK:
        return '#3b82f6';
      case CalendarEventType.TRAINING:
        return '#3b82f6';
      case CalendarEventType.WORKSHOP:
        return '#10b981';
      case CalendarEventType.REVIEW:
        return '#f59e0b';
      case CalendarEventType.PRESENTATION:
        return '#ec4899';
      case CalendarEventType.CLIENT_MEETING:
        return '#14b8a6';
      case CalendarEventType.TEAM_BUILDING:
        return '#f97316';
      case CalendarEventType.ANNOUNCEMENT:
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  // Combine tasks and calendar events into calendar format
  const calendarData = useMemo(() => {
    const events: CalendarEventExtended[] = [];

    // Add tasks as events
    tasks.forEach(task => {
      // Add task deadline as event
      events.push({
        id: `task-deadline-${task.id}`,
        title: `📋 ${task.name} (Deadline)`,
        start: task.deadline,
        end: task.deadline,
        type: CalendarEventType.DEADLINE,
        relatedTaskId: task.id,
        description: task.description,
        createdBy: task.createdBy,
        createdByName: task.createdByName,
        color: '#ef4444',
        originalEvent: task
      });

      // Add task duration if it has start and end dates
      if (task.startDate && task.status === TaskStatus.IN_PROGRESS) {
        const endDate = task.completedAt || new Date();
        events.push({
          id: `task-duration-${task.id}`,
          title: `🔄 ${task.name}`,
          start: task.startDate,
          end: endDate,
          type: CalendarEventType.TASK,
          relatedTaskId: task.id,
          description: task.description,
          createdBy: task.createdBy,
          createdByName: task.createdByName,
          color: '#3b82f6',
          originalEvent: task
        });
      } else if (task.startDate && task.completedAt) {
        events.push({
          id: `task-completed-${task.id}`,
          title: `✅ ${task.name}`,
          start: task.startDate,
          end: task.completedAt,
          type: CalendarEventType.TASK,
          relatedTaskId: task.id,
          description: task.description,
          createdBy: task.createdBy,
          createdByName: task.createdByName,
          color: '#22c55e',
          originalEvent: task
        });
      }
    });

    // Add manual calendar events (filtered by participant groups)
    calendarEvents.forEach(event => {
      // Check if current user should see this event based on their employment type
      const userEmploymentType = user?.employmentType;
      const canSeeEvent = event.participantGroups && (
        (userEmploymentType === 'FL' && event.participantGroups.freelance) ||
        (userEmploymentType === 'PT' && event.participantGroups.partTime) ||
        (userEmploymentType === 'FT' && event.participantGroups.fullTime) ||
        user?.isAdmin // Admins can see all events
      );

      if (canSeeEvent) {
        events.push({
          id: event.id,
          title: `${getEventIcon(event.type)} ${event.title}`,
          start: event.start,
          end: event.end,
          type: event.type,
          description: event.description,
          createdBy: event.createdBy,
          createdByName: event.createdByName,
          color: event.color || getEventColor(event.type),
          originalEvent: event
        });
      }
    });

    return events;
  }, [tasks, calendarEvents]);

  useEffect(() => {
    if (!user) return;

    // Listen for all tasks
    const tasksQuery = query(collection(db, 'tasks'));
    const tasksUnsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        deadline: doc.data().deadline?.toDate(),
        assignedAt: doc.data().assignedAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate(),
        submittedAt: doc.data().submittedAt?.toDate(),
        startDate: doc.data().startDate?.toDate(),
      })) as Task[];
      
      setTasks(tasksData);
      setLoading(false);
    });

    // Listen for calendar events
    const eventsQuery = query(collection(db, 'calendar'));
    const eventsUnsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        start: doc.data().start?.toDate(),
        end: doc.data().end?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as CalendarEvent[];
      
      setCalendarEvents(eventsData);
    }, (error) => {
      console.error('Error fetching calendar events:', error);
    });

    return () => {
      tasksUnsubscribe();
      eventsUnsubscribe();
    };
  }, [user]);

  const handleEventSelect = (event: CalendarEventExtended) => {
    setSelectedEvent(event);
  };

  const handleCreateEvent = async (eventData: Partial<CalendarEvent>) => {
    if (!user) {
      console.error('No user logged in');
      return;
    }

    console.log('handleCreateEvent called with data:', eventData);
    console.log('User:', user);
    console.log('Firebase db object:', db);

    try {
      console.log('Attempting to save to Firebase calendar collection...');
      
      const dataToSave = {
        ...eventData,
        createdBy: user.uid,
        createdByName: user.fullname,
        createdAt: Timestamp.fromDate(new Date()),
        start: Timestamp.fromDate(eventData.start!),
        end: Timestamp.fromDate(eventData.end!),
      };

      // Remove undefined fields to prevent Firebase errors
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === undefined) {
          delete dataToSave[key];
        }
      });
      
      console.log('Data being saved to Firebase (after cleaning):', dataToSave);
      
      const docRef = await addDoc(collection(db, 'calendar'), dataToSave);

      console.log('✅ Event saved to Firebase with ID:', docRef.id);
      
      // Use dynamic import for SweetAlert2 (client-side only)
      const { default: Swal } = await import('sweetalert2');
      await Swal.fire({
        title: 'Berjaya!',
        text: 'Acara telah disimpan dengan berjaya',
        icon: 'success',
        confirmButtonText: 'OK',
        confirmButtonColor: '#000000',
        customClass: {
          popup: 'swal-high-z-index'
        },
        backdrop: true,
        allowOutsideClick: false
      });

      // Send notifications if enabled
      if (eventData.notificationSettings) {
        try {
          // Get users based on employment type selection
          const usersQuery = query(collection(db, 'users'));
          const usersSnapshot = await getDocs(usersQuery);

          const allUsers = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Filter users based on participant groups and notification settings
          const usersToNotify = allUsers.filter(u => {
            if (!u.isApproved || u.isAdmin) return false; // Only notify approved non-admin users
            
            return (
              (eventData.participantGroups?.freelance && eventData.notificationSettings?.notifyFreelance && u.employmentType === 'FL') ||
              (eventData.participantGroups?.partTime && eventData.notificationSettings?.notifyPartTime && u.employmentType === 'PT') ||
              (eventData.participantGroups?.fullTime && eventData.notificationSettings?.notifyFullTime && u.employmentType === 'FT')
            );
          });

          // Send notifications using the proper notification service
          const eventDate = eventData.start ? new Date(eventData.start).toLocaleDateString('ms-MY') : '';
          const notificationTitle = 'Acara Kalendar Baru';
          const notificationMessage = `Acara "${eventData.title}" telah dijadualkan pada ${eventDate}. ${eventData.description ? eventData.description : ''}`;

          for (const user of usersToNotify) {
            await notificationService.sendInAppNotification({
              userId: user.id,
              title: notificationTitle,
              message: notificationMessage,
              type: 'system',
              relatedId: docRef.id
            });
          }

          console.log(`Calendar notifications sent to ${usersToNotify.length} users`);
        } catch (notificationError) {
          console.error('Error sending notifications:', notificationError);
          // Don't fail the event creation if notification fails
        }
      }

      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating event:', error);
      console.error('Event data that failed:', eventData);
      console.error('User data:', user);
      // Don't close modal on error so user can try again
    }
  };

  const eventStyleGetter = (event: CalendarEventExtended) => {
    return {
      style: {
        backgroundColor: event.color,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Kalendar & Gantt Chart</h1>
            <p className="text-gray-600">Lihat tugasan dan acara dalam kalendar</p>
          </div>
          {user?.isAdmin && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Acara
            </Button>
          )}
        </div>

        {/* Calendar Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <CalendarIcon className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Tugasan</p>
                  <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Acara Manual</p>
                  <p className="text-2xl font-bold text-gray-900">{calendarEvents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Tugasan Aktif</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Eye className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Acara</p>
                  <p className="text-2xl font-bold text-gray-900">{calendarData.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Calendar Component */}
      <Card>
        <CardContent className="p-6">
          <div style={{ height: '600px' }}>
            <Calendar
              localizer={localizer}
              events={calendarData}
              startAccessor="start"
              endAccessor="end"
              view={currentView}
              onView={setCurrentView}
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectEvent={handleEventSelect}
              eventPropGetter={eventStyleGetter}
              popup
              views={['month', 'week', 'day', 'agenda']}
              messages={{
                next: "Berikut",
                previous: "Sebelum",
                today: "Hari Ini",
                month: "Bulan",
                week: "Minggu", 
                day: "Hari",
                agenda: "Agenda",
                date: "Tarikh",
                time: "Masa",
                event: "Acara",
                noEventsInRange: "Tiada acara dalam tempoh ini",
                showMore: total => `+${total} lagi`
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Create Event Modal */}
      {showCreateModal && user?.isAdmin && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateEvent}
        />
      )}
    </div>
  );
}