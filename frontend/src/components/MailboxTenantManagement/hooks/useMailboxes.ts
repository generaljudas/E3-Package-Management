import { useState } from 'react';
import type { Mailbox } from '../../../types';
import { mailboxApi } from '../../../services/api';

interface UseMailboxesReturn {
  mailboxes: Mailbox[];
  loading: boolean;
  loadMailboxes: () => Promise<void>;
  searchMailboxes: (query: string) => Promise<Mailbox[]>;
  createMailbox: (mailboxNumber: string) => Promise<void>;
  deleteMailbox: (mailboxId: number) => Promise<void>;
}

export const useMailboxes = (
  onError?: (error: string) => void,
  onSuccess?: (message: string) => void
): UseMailboxesReturn => {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMailboxes = async () => {
    setLoading(true);
    try {
      const response = await mailboxApi.getAll();
      setMailboxes(response.mailboxes);
    } catch (error) {
      console.error('Error loading mailboxes:', error);
      onError?.('Failed to load mailboxes');
    } finally {
      setLoading(false);
    }
  };

  const searchMailboxes = async (query: string): Promise<Mailbox[]> => {
    if (!query.trim()) {
      return [];
    }

    setLoading(true);
    try {
      const response = await mailboxApi.getAll();
      const allMailboxes = response.mailboxes;
      
      const queryLower = query.toLowerCase().trim();
      const filtered = allMailboxes.filter((mailbox) => {
        const mailboxNumberMatch = mailbox.mailbox_number.toLowerCase().includes(queryLower);
        const tenantMatch = mailbox.default_tenant_name?.toLowerCase().includes(queryLower);
        return mailboxNumberMatch || tenantMatch;
      });

      // Sort results for best matches first
      filtered.sort((a, b) => {
        const aNumber = a.mailbox_number.toLowerCase();
        const bNumber = b.mailbox_number.toLowerCase();
        
        // Exact mailbox number match first
        if (aNumber === queryLower) return -1;
        if (bNumber === queryLower) return 1;
        
        // Mailbox number starts with query
        const aStarts = aNumber.startsWith(queryLower);
        const bStarts = bNumber.startsWith(queryLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Sort by mailbox number numerically
        return parseInt(a.mailbox_number) - parseInt(b.mailbox_number);
      });

      return filtered;
    } catch (error) {
      console.error('Error searching mailboxes:', error);
      onError?.('Failed to search mailboxes');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const createMailbox = async (mailboxNumber: string) => {
    if (!mailboxNumber.trim()) {
      onError?.('Please enter a mailbox number');
      return;
    }

    setLoading(true);
    try {
      await mailboxApi.create({ mailbox_number: mailboxNumber });
      onSuccess?.(`Mailbox ${mailboxNumber} created successfully`);
    } catch (error) {
      console.error('Error creating mailbox:', error);
      onError?.('Failed to create mailbox');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteMailbox = async (mailboxId: number) => {
    setLoading(true);
    try {
      await mailboxApi.delete(mailboxId);
      onSuccess?.('Mailbox deleted successfully');
    } catch (error) {
      console.error('Error deleting mailbox:', error);
      onError?.('Failed to delete mailbox');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    mailboxes,
    loading,
    loadMailboxes,
    searchMailboxes,
    createMailbox,
    deleteMailbox,
  };
};
