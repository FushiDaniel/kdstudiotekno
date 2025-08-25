'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skill, UserSkill, User } from '@/types';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Plus, X, Check, Settings, Award, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SkillSelectorProps {
  user: User;
  onSkillsChange?: (skills: UserSkill[]) => void;
  isEditing: boolean;
  onToggleEdit?: () => void;
}

export default function SkillSelector({ user, onSkillsChange, isEditing, onToggleEdit }: SkillSelectorProps) {
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  // Listen for available skills
  useEffect(() => {
    const skillsQuery = query(collection(db, 'skills'));
    const unsubscribe = onSnapshot(skillsQuery, (snapshot) => {
      const skills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Skill[];
      setAvailableSkills(skills);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Listen for user skills
  useEffect(() => {
    if (!user?.uid) return;

    const userSkillsQuery = query(
      collection(db, 'userSkills'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(userSkillsQuery, (snapshot) => {
      const skills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        assignedAt: doc.data().assignedAt?.toDate() || new Date(),
        verifiedAt: doc.data().verifiedAt?.toDate()
      })) as UserSkill[];
      
      setUserSkills(skills);
      onSkillsChange?.(skills);
    });

    return unsubscribe;
  }, [user?.uid, onSkillsChange]);

  const handleAddSkill = async (skillId: string) => {
    if (!user || !currentUser) return;

    const skill = availableSkills.find(s => s.id === skillId);
    if (!skill) return;

    try {
      const userSkillId = `${user.uid}_${skillId}`;
      await setDoc(doc(db, 'userSkills', userSkillId), {
        userId: user.uid,
        skillId: skillId,
        skillName: skill.name,
        verified: false,
        assignedAt: Timestamp.fromDate(new Date())
      });

      setSelectedSkillId('');
      setShowDropdown(false);
    } catch (error) {
      console.error('Error adding skill:', error);
      alert('Gagal menambah kemahiran. Sila cuba lagi.');
    }
  };

  const handleRemoveSkill = async (userSkillId: string) => {
    if (!confirm('Adakah anda pasti ingin mengeluarkan kemahiran ini?')) return;

    try {
      await deleteDoc(doc(db, 'userSkills', userSkillId));
    } catch (error) {
      console.error('Error removing skill:', error);
      alert('Gagal mengeluarkan kemahiran. Sila cuba lagi.');
    }
  };

  const getUnassignedSkills = () => {
    const assignedSkillIds = userSkills.map(us => us.skillId);
    return availableSkills.filter(skill => !assignedSkillIds.includes(skill.id));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <Award className="h-5 w-5 mr-2" />
          Kemahiran
        </CardTitle>
        {onToggleEdit && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onToggleEdit}
            className={isEditing ? 'bg-black text-white hover:bg-gray-800' : ''}
          >
            {isEditing ? (
              <CheckCircle className="h-4 w-4 mr-2" />
            ) : (
              <Settings className="h-4 w-4 mr-2" />
            )}
            {isEditing ? 'Selesai' : 'Urus'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Add Skill Section - Only show when editing */}
        {isEditing && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full justify-start"
                disabled={getUnassignedSkills().length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                {getUnassignedSkills().length === 0 
                  ? 'Semua kemahiran telah ditambah' 
                  : 'Tambah Kemahiran'
                }
              </Button>

              {showDropdown && getUnassignedSkills().length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {getUnassignedSkills().map(skill => (
                    <button
                      key={skill.id}
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
        )}

        {/* Current Skills */}
        {userSkills.length > 0 ? (
          <div className="space-y-2">
            {userSkills.map((userSkill) => (
              <div
                key={userSkill.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <Badge 
                    variant="secondary" 
                    className={`${userSkill.verified ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{userSkill.skillName}</span>
                      {userSkill.verified && (
                        <Check className="h-3 w-3 text-blue-600" />
                      )}
                    </div>
                  </Badge>
                  {userSkill.verified && userSkill.verifiedByName && (
                    <span className="text-xs text-gray-500">
                      Disahkan oleh {userSkill.verifiedByName}
                    </span>
                  )}
                </div>
                
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSkill(userSkill.id)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Award className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-500">Tiada kemahiran ditambah lagi</p>
            {isEditing && getUnassignedSkills().length > 0 && (
              <p className="text-sm text-gray-400 mt-1">Klik "Tambah Kemahiran" untuk mula menambah</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}