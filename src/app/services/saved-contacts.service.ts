import { Injectable } from '@angular/core';

export interface SavedContact {
  id: string;
  name: string;
  phoneDigits: string;
  color: string;
}

const STORAGE_PREFIX = 'nets_saved_contacts_';
const CONTACT_COLORS = ['#2f80ed', '#27ae60', '#eb5757', '#f2c94c', '#9b51e0', '#f2994a'];

const DEFAULT_CONTACTS: Record<string, SavedContact[]> = {
  user_1: [{ id: 'default_sarah', name: 'Sarah', phoneDigits: '87654321', color: '#27ae60' }],
  user_2: [{ id: 'default_alex', name: 'Alex', phoneDigits: '91234567', color: '#2f80ed' }],
};

@Injectable({
  providedIn: 'root',
})
export class SavedContactsService {
  getContacts(userId: string): SavedContact[] {
    const stored = this.readStorage(userId);
    if (stored.length) {
      return stored;
    }

    const defaults = DEFAULT_CONTACTS[userId] ?? [];
    if (defaults.length) {
      this.writeStorage(userId, defaults);
    }
    return defaults;
  }

  saveContact(userId: string, contact: Omit<SavedContact, 'id'>): SavedContact {
    const saved: SavedContact = {
      ...contact,
      id: `contact_${Date.now()}`,
    };
    const contacts = this.getContacts(userId);
    this.writeStorage(userId, [...contacts, saved]);
    return saved;
  }

  updateContact(
    userId: string,
    contactId: string,
    updates: Pick<SavedContact, 'name' | 'phoneDigits'>
  ): SavedContact | null {
    const contacts = this.getContacts(userId);
    const index = contacts.findIndex((contact) => contact.id === contactId);
    if (index < 0) {
      return null;
    }

    const updated: SavedContact = {
      ...contacts[index],
      name: updates.name.trim(),
      phoneDigits: updates.phoneDigits,
    };
    contacts[index] = updated;
    this.writeStorage(userId, contacts);
    return updated;
  }

  deleteContact(userId: string, contactId: string): boolean {
    const contacts = this.getContacts(userId);
    const next = contacts.filter((contact) => contact.id !== contactId);
    if (next.length === contacts.length) {
      return false;
    }

    this.writeStorage(userId, next);
    return true;
  }

  formatPhone(digits: string): string {
    const clean = digits.replace(/\D/g, '').slice(-8);
    if (clean.length !== 8) {
      return '';
    }
    return `+65 ${clean.slice(0, 4)} ${clean.slice(4)}`;
  }

  private readStorage(userId: string): SavedContact[] {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as SavedContact[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeStorage(userId: string, contacts: SavedContact[]): void {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(contacts));
  }

  nextColor(existing: SavedContact[]): string {
    const used = new Set(existing.map((c) => c.color));
    return CONTACT_COLORS.find((color) => !used.has(color)) ?? CONTACT_COLORS[existing.length % CONTACT_COLORS.length];
  }
}
