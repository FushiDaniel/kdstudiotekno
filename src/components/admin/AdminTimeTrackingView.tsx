'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ClockInRecord, User } from '@/types';
import { collection, query, onSnapshot, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firebaseCache } from '@/lib/firebase-cache';
import { formatDate, formatTime } from '@/lib/utils';
import { Clock, MapPin, Search, Calendar, Users, Filter } from 'lucide-react';

export default function AdminTimeTrackingView() {
  const [clockInRecords, setClockInRecords] = useState<ClockInRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<ClockInRecord | null>(null);
  const [showMap, setShowMap] = useState(false);

  // Fetch all FT and PT users using cache
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await firebaseCache.getCachedCollection<User>('users');
        
        // Filter for FT and PT users only
        const ftPtUsers = allUsers.filter(user => 
          user.staffId?.startsWith('FT') || user.staffId?.startsWith('PT')
        );
        
        setUsers(ftPtUsers);
        console.log(`⏰ AdminTimeTrackingView: Loaded ${ftPtUsers.length} FT/PT users from cache/firestore`);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

  // Fetch clock-in records using cache
  useEffect(() => {
    const unsubscribe = firebaseCache.setupRealtimeListener<ClockInRecord>(
      'clockInRecords',
      (records) => {
        try {
          // Filter for FT and PT users only and ensure proper data conversion
          const ftPtRecords = records
            .filter(record => 
              record.userStaffId?.startsWith('FT') || record.userStaffId?.startsWith('PT')
            )
            .map(record => ({
              ...record,
              // Ensure dates are properly converted from Firestore timestamps
              clockInTime: record.clockInTime instanceof Date ? record.clockInTime : 
                          record.clockInTime?.toDate ? record.clockInTime.toDate() : 
                          new Date(record.clockInTime),
              clockOutTime: record.clockOutTime instanceof Date ? record.clockOutTime : 
                           record.clockOutTime?.toDate ? record.clockOutTime.toDate() : 
                           record.clockOutTime ? new Date(record.clockOutTime) : null,
              // Ensure totalMinutes is a number
              totalMinutes: record.totalMinutes ? Number(record.totalMinutes) : undefined
            }));
          
          console.log(`⏰ AdminTimeTrackingView: Loaded ${ftPtRecords.length} FT/PT clock-in records from cache/firestore`);
          console.log('Sample records:', ftPtRecords.slice(0, 3).map(r => ({
            id: r.id,
            date: r.date,
            totalMinutes: r.totalMinutes,
            userStaffId: r.userStaffId,
            clockInTime: r.clockInTime,
            clockOutTime: r.clockOutTime
          })));
          
          setClockInRecords(ftPtRecords);
          setLoading(false);
        } catch (error) {
          console.error('Error processing clock in records:', error);
          setLoading(false);
        }
      },
      {
        orderBy: ['clockInTime', 'desc']
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter records based on search criteria
  const filteredRecords = useMemo(() => {
    let filtered = clockInRecords;

    // Filter by search term (user name or staff ID)
    if (searchTerm) {
      filtered = filtered.filter(record =>
        record.userFullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.userStaffId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by selected user
    if (selectedUser !== 'all') {
      filtered = filtered.filter(record => record.userId === selectedUser);
    }

    // Filter by selected date
    if (selectedDate) {
      filtered = filtered.filter(record => record.date === selectedDate);
    }

    return filtered;
  }, [clockInRecords, searchTerm, selectedUser, selectedDate]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}j ${mins}m`;
  };

  const getTotalHoursForUser = (userId: string, date?: string) => {
    let userRecords = clockInRecords.filter(record => record.userId === userId);
    
    if (date) {
      userRecords = userRecords.filter(record => record.date === date);
    }
    
    const totalMinutes = userRecords.reduce((total, record) => 
      total + (record.totalMinutes || 0), 0
    );
    
    return formatDuration(totalMinutes);
  };

  const getMonthlyStatsForUser = (userId: string) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    console.log(`Calculating monthly stats for user ${userId} for ${currentMonth + 1}/${currentYear}`);
    
    const monthlyRecords = clockInRecords.filter(record => {
      if (!record.date || record.userId !== userId) return false;
      
      // Handle both date string formats: "YYYY-MM-DD" and Date object
      let recordDate;
      if (typeof record.date === 'string') {
        // Parse YYYY-MM-DD as local date, not UTC to avoid timezone issues
        const [year, month, day] = record.date.split('-').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          console.warn(`Invalid date format for record ${record.id}: ${record.date}`);
          return false;
        }
        recordDate = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        recordDate = new Date(record.date);
      }
      
      const isCurrentMonth = recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
      
      if (isCurrentMonth) {
        console.log(`Found monthly record for user ${userId}:`, {
          id: record.id,
          date: record.date,
          totalMinutes: record.totalMinutes,
          clockInTime: record.clockInTime,
          clockOutTime: record.clockOutTime
        });
      }
      
      return isCurrentMonth;
    });

    console.log(`Found ${monthlyRecords.length} monthly records for user ${userId}`);

    const totalMinutes = monthlyRecords
      .filter(record => record.totalMinutes && record.totalMinutes > 0)
      .reduce((total, record) => {
        console.log(`Adding ${record.totalMinutes} minutes from record ${record.id}`);
        return total + (record.totalMinutes || 0);
      }, 0);

    const totalSessions = monthlyRecords.filter(record => record.clockInTime).length;
    const daysWorked = new Set(monthlyRecords.map(record => record.date)).size;

    console.log(`User ${userId} monthly stats:`, {
      totalMinutes,
      totalSessions,
      daysWorked,
      recordCount: monthlyRecords.length
    });

    return {
      totalMinutes,
      totalSessions,
      daysWorked
    };
  };

  const getAllStaffMonthlySummary = () => {
    return users.map(user => ({
      ...user,
      monthlyStats: getMonthlyStatsForUser(user.uid)
    }));
  };

  const openMapModal = useCallback((record: ClockInRecord) => {
    setSelectedRecord(record);
    setShowMap(true);
  }, []);

  const closeMapModal = useCallback(() => {
    setShowMap(false);
  }, []);

  const MapModal = useMemo(() => {
    if (!selectedRecord || !selectedRecord.coordinates) return null;

    const { latitude, longitude } = selectedRecord.coordinates;
    const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-900">
                Lokasi Clock In - {selectedRecord.userFullName}
              </CardTitle>
              <Button 
                variant="ghost" 
                onClick={closeMapModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-96">
              <iframe
                key={`map-${selectedRecord.id}`}
                src={mapUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="p-4 bg-gray-50">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Masa:</span> {formatTime(selectedRecord.clockInTime)}
                </div>
                <div>
                  <span className="font-medium">Tarikh:</span> {formatDate(selectedRecord.clockInTime)}
                </div>
                <div>
                  <span className="font-medium">Koordinat:</span> {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </div>
                <div>
                  <span className="font-medium">Ketepatan:</span> {selectedRecord.coordinates.accuracy?.toFixed(0)}m
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }, [selectedRecord, closeMapModal]);

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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Admin - Pantau Masa Pekerja
        </h1>
        <p className="text-gray-600">
          Pantau rekod clock in/out untuk pekerja FT dan PT
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari nama atau ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Pekerja</option>
                {users.map(user => (
                  <option key={user.uid} value={user.uid}>
                    {user.fullname} ({user.staffId})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="flex items-center text-sm text-gray-600">
              <Filter className="h-4 w-4 mr-2" />
              {filteredRecords.length} rekod
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Pekerja Aktif</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Clock In Hari Ini</p>
                <p className="text-2xl font-bold">
                  {clockInRecords.filter(r => {
                    const today = new Date();
                    const todayString = today.getFullYear() + '-' + 
                      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(today.getDate()).padStart(2, '0');
                    return r.date === todayString;
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Rekod</p>
                <p className="text-2xl font-bold">{clockInRecords.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Summary for Each Staff */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Ringkasan Bulanan Pekerja - {new Date().toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Pekerja</th>
                  <th className="text-left p-3 font-medium">Jumlah Jam</th>
                  <th className="text-left p-3 font-medium">Hari Bekerja</th>
                  <th className="text-left p-3 font-medium">Total Sesi</th>
                </tr>
              </thead>
              <tbody>
                {getAllStaffMonthlySummary().map((staff) => (
                  <tr key={staff.uid} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{staff.fullname}</div>
                        <div className="text-sm text-gray-500">{staff.staffId}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-lg font-semibold text-blue-600">
                        {formatDuration(staff.monthlyStats.totalMinutes)}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-lg font-semibold text-green-600">
                        {staff.monthlyStats.daysWorked}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-lg font-semibold text-purple-600">
                        {staff.monthlyStats.totalSessions}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {users.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Tiada pekerja ditemui
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rekod Clock In/Out</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Pekerja</th>
                  <th className="text-left p-3 font-medium">Tarikh</th>
                  <th className="text-left p-3 font-medium">Clock In</th>
                  <th className="text-left p-3 font-medium">Clock Out</th>
                  <th className="text-left p-3 font-medium">Tempoh</th>
                  <th className="text-left p-3 font-medium">Lokasi</th>
                  <th className="text-left p-3 font-medium">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{record.userFullName}</div>
                        <div className="text-sm text-gray-500">{record.userStaffId}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      {formatDate(record.clockInTime)}
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        {formatTime(record.clockInTime)}
                      </div>
                    </td>
                    <td className="p-3">
                      {record.clockOutTime ? (
                        <div className="text-sm">
                          {formatTime(record.clockOutTime)}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Aktif
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {record.totalMinutes ? (
                        formatDuration(record.totalMinutes)
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-sm truncate max-w-32">
                          {record.location || 'Tidak diketahui'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      {record.coordinates && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openMapModal(record)}
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          Peta
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredRecords.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Tiada rekod ditemui
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Map Modal */}
      {showMap && MapModal}
    </div>
  );
}