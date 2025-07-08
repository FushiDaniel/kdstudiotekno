'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClockInRecord } from '@/types';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatTime, formatDate } from '@/lib/utils';
import { Play, Square, Calendar, MapPin } from 'lucide-react';

export default function ClockInView() {
  const { user } = useAuth();
  const [clockInRecords, setClockInRecords] = useState<ClockInRecord[]>([]);
  const [activeSession, setActiveSession] = useState<ClockInRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'clockInRecords'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const records = snapshot.docs.map(doc => {
          const data = doc.data();
          let location = 'Web App';
          
          // Handle GeoPoint location if it exists
          if (data.location && typeof data.location === 'object' && '_lat' in data.location && '_long' in data.location) {
            location = `${data.location._lat.toFixed(6)}, ${data.location._long.toFixed(6)}`;
          } else if (typeof data.location === 'string') {
            location = data.location;
          }

          return {
            id: doc.id,
            ...data,
            clockInTime: data.clockInTime?.toDate() || null,
            clockOutTime: data.clockOutTime?.toDate() || null,
            location: location,
            date: data.date || new Date().toISOString().split('T')[0]
          };
        }) as ClockInRecord[];
        
        const sortedRecords = records.sort((a, b) => 
          (b.clockInTime?.getTime() || 0) - (a.clockInTime?.getTime() || 0)
        );
        
        setClockInRecords(sortedRecords);
        const active = sortedRecords.find(record => !record.clockOutTime);
        setActiveSession(active || null);
      } catch (error) {
        console.error('Error processing clock in records:', error);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching clock in records:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleClockIn = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      const existingActive = clockInRecords.find(record => 
        record.date === today && !record.clockOutTime
      );

      if (existingActive) {
        throw new Error('Anda sudah mempunyai sesi aktif');
      }

      // Check daily session limit (2 sessions per day)
      const todayRecords = clockInRecords.filter(record => record.date === today);
      if (todayRecords.length >= 2) {
        throw new Error('Had 2 sesi sehari telah dicapai');
      }

      // Check time restrictions (10am-10pm) for FT and PT users
      const currentHour = now.getHours();
      if (user.staffId?.startsWith('FT') || user.staffId?.startsWith('PT')) {
        if (currentHour < 10 || currentHour >= 22) {
          throw new Error('Clock in hanya dibenarkan antara 10:00 PG hingga 10:00 PTG');
        }
      }

      // Get GPS coordinates
      let locationData = 'Web App';
      let coordinates = null;
      
      try {
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000
            });
          });
          
          coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          
          locationData = `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
        }
      } catch (geoError) {
        console.warn('Could not get location:', geoError);
        // Continue with default location if GPS fails
      }

      const newRecord = {
        userId: user.uid,
        clockInTime: Timestamp.fromDate(now),
        date: today,
        location: locationData,
        coordinates: coordinates,
        userFullName: user.fullname,
        userStaffId: user.staffId
      };

      await addDoc(collection(db, 'clockInRecords'), newRecord);
    } catch (error) {
      console.error('Error clocking in:', error);
      alert(error instanceof Error ? error.message : 'Failed to clock in');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user || !activeSession?.clockInTime) return;

    try {
      setLoading(true);
      const now = new Date();
      const clockInTime = activeSession.clockInTime;
      const totalMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / (1000 * 60));

      if (totalMinutes < 1) {
        throw new Error('Tempoh sesi terlalu singkat');
      }

      // Check session duration limit (2 hours 30 minutes = 150 minutes)
      const maxSessionMinutes = 150;
      const actualMinutes = Math.min(totalMinutes, maxSessionMinutes);

      if (totalMinutes > maxSessionMinutes) {
        alert(`Sesi melebihi had masa 2 jam 30 minit. Masa yang direkodkan: ${formatDuration(actualMinutes)}`);
      }

      await updateDoc(doc(db, 'clockInRecords', activeSession.id), {
        clockOutTime: Timestamp.fromDate(now),
        totalMinutes: actualMinutes,
      });
    } catch (error) {
      console.error('Error clocking out:', error);
      alert(error instanceof Error ? error.message : 'Failed to clock out');
    } finally {
      setLoading(false);
    }
  };

  const getTodayTotalMinutes = () => {
    const today = new Date().toISOString().split('T')[0];
    return clockInRecords
      .filter(record => record.date === today && record.totalMinutes)
      .reduce((total, record) => total + (record.totalMinutes || 0), 0);
  };

  const getCurrentSessionDuration = () => {
    if (!activeSession?.clockInTime) return 0;
    const now = new Date();
    const diff = now.getTime() - activeSession.clockInTime.getTime();
    return Math.floor(diff / (1000 * 60));
  };

  const formatTimeWithPeriod = (date: Date | null) => {
    if (!date) return '--:--';
    try {
      const hours = date.getHours();
      const period = hours >= 12 ? 'PTG' : 'PG';
      return `${formatTime(date)} ${period}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return '--:--';
    }
  };

  const formatDateSafe = (date: Date | string | null) => {
    if (!date) return '--/--/----';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return formatDate(dateObj);
    } catch (error) {
      console.error('Error formatting date:', error);
      return '--/--/----';
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}j ${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Daftar Masuk / Keluar</h1>
        <p className="text-gray-600">Jejak masa kerja anda</p>
      </div>

      {/* Today's Sessions */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-2">Sesi Hari Ini</h2>
          <div className="text-4xl font-bold text-gray-900">
            {getTodayTotalMinutes() > 0 ? formatDuration(getTodayTotalMinutes()) : '0j 0m'}
          </div>
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>Sesi: {clockInRecords.filter(r => r.date === new Date().toISOString().split('T')[0]).length}/2</span>
            <span>Had: 5j 0m</span>
          </div>
        </CardContent>
      </Card>

      {/* Current Time & Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-gray-900">
              {formatTimeWithPeriod(currentTime)}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {formatDateSafe(currentTime)}
            </div>
          </div>

          {activeSession ? (
            <div className="space-y-4">
              <div className={`${getCurrentSessionDuration() > 120 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'} border rounded-lg p-3`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs ${getCurrentSessionDuration() > 120 ? 'text-orange-800' : 'text-green-800'}`}>Masuk:</p>
                    <p className={`font-semibold ${getCurrentSessionDuration() > 120 ? 'text-orange-900' : 'text-green-900'}`}>
                      {formatTimeWithPeriod(activeSession.clockInTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs ${getCurrentSessionDuration() > 120 ? 'text-orange-800' : 'text-green-800'}`}>Tempoh Masa:</p>
                    <p className={`font-semibold ${getCurrentSessionDuration() > 120 ? 'text-orange-900' : 'text-green-900'}`}>
                      {formatDuration(getCurrentSessionDuration())}
                    </p>
                    {getCurrentSessionDuration() > 120 && (
                      <p className="text-xs text-orange-600 mt-1">
                        Had: 2j 30m
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={handleClockOut}
                variant="destructive"
                className="w-full"
                disabled={loading}
              >
                <Square className="h-4 w-4 mr-2" />
                {loading ? 'Memproses...' : 'Daftar Keluar'}
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleClockIn}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              disabled={loading}
            >
              <Play className="h-4 w-4 mr-2" />
              {loading ? 'Memproses...' : 'Daftar Masuk'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Recent Records */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Rekod Terkini</h2>
        {clockInRecords.slice(0, 5).map((record) => (
          <Card key={record.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="font-medium">{formatDateSafe(record.date)}</p>
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-3 w-3 mr-1" />
                      {record.location}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    <span>Masuk: </span>
                    <span className="font-medium">{formatTimeWithPeriod(record.clockInTime)}</span>
                  </div>
                  {record.clockOutTime && (
                    <div className="text-sm">
                      <span>Keluar: </span>
                      <span className="font-medium">{formatTimeWithPeriod(record.clockOutTime)}</span>
                    </div>
                  )}
                  {record.totalMinutes && (
                    <div className="text-xs font-medium text-gray-500 mt-1">
                      {formatDuration(record.totalMinutes)}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}