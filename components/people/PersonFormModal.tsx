'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { personSchema, PersonFormData } from '@/lib/validation';
import { Person } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface PersonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  person?: Person | null;
  onSuccess: () => void;
}

export const PersonFormModal: React.FC<PersonFormModalProps> = ({
  isOpen,
  onClose,
  person,
  onSuccess,
}) => {
  const supabase = createClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      country_code: '+91',
    },
  });

  useEffect(() => {
    if (person) {
      reset({
        name: person.name,
        phone: person.phone,
        country_code: person.country_code || '+91',
        email: person.email || '',
        notes: person.notes || '',
      });
    } else {
      reset({
        name: '',
        phone: '',
        country_code: '+91',
        email: '',
        notes: '',
      });
    }
  }, [person, reset, isOpen]);

  const onSubmit = async (data: PersonFormData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      if (person) {
        // Update
        const { error } = await supabase
          .from('people')
          .update({
            name: data.name,
            phone: data.phone,
            country_code: data.country_code,
            email: data.email || null,
            notes: data.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', person.id);

        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase.from('people').insert({
          user_id: userData.user.id,
          name: data.name,
          phone: data.phone,
          country_code: data.country_code,
          email: data.email || null,
          notes: data.notes || null,
        });

        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error saving person record');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={person ? 'Edit Person Profile' : 'Add New Person'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Full Name *"
          placeholder="e.g. Rahul Sharma"
          {...register('name')}
          error={errors.name?.message}
        />

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Input
              label="Code"
              placeholder="+91"
              {...register('country_code')}
              error={errors.country_code?.message}
            />
          </div>
          <div className="col-span-2">
            <Input
              label="Phone Number *"
              placeholder="9876543210"
              {...register('phone')}
              error={errors.phone?.message}
            />
          </div>
        </div>

        <Input
          label="Email Address (Optional)"
          type="email"
          placeholder="rahul@example.com"
          {...register('email')}
          error={errors.email?.message}
        />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Notes (Optional)
          </label>
          <textarea
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
            rows={3}
            placeholder="Add context or reminder details..."
            {...register('notes')}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          {person ? (
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (
                  !confirm(
                    `Are you sure you want to delete ${person.name}? WARNING: This action will also remove associated financial history records!`
                  )
                ) {
                  return;
                }
                try {
                  const { error } = await supabase.from('people').delete().eq('id', person.id);
                  if (error) throw error;
                  onSuccess();
                  onClose();
                } catch (err: any) {
                  alert(err.message || 'Error deleting person');
                }
              }}
            >
              Delete Person
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {person ? 'Save Changes' : 'Create Person'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
