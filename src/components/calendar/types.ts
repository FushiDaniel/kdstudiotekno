import { Event } from 'react-big-calendar';
import { CalendarEvent, CalendarEventType, Task } from '@/types';

export interface CalendarEventExtended extends Event {
  id: string;
  type: CalendarEventType;
  relatedTaskId?: string;
  description?: string;
  createdBy: string;
  createdByName: string;
  color?: string;
  originalEvent: CalendarEvent | Task;
}