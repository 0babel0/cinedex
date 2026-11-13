// Discreet "back up your diary" notice, shown when the last export is older than 30 days.

import { t } from '../i18n.js';
import { getSetting } from '../settings.js';
import { h } from '../ui.js';

const DAY = 86400000;
const THRESHOLD_DAYS = 30;

/** Returns a notice element, or null when no reminder is due. */
export function exportReminder(items) {
  if (!items.length) return null;
  const last = getSetting('lastExportAt');
  // Never exported: count from the oldest entry instead.
  const since = last || items.reduce((min, i) => (i.createdAt < min ? i.createdAt : min), items[0].createdAt);
  const days = Math.floor((Date.now() - Date.parse(since)) / DAY);
  if (!(days > THRESHOLD_DAYS)) return null;
  return h('a', { class: 'reminder', href: '#/settings' },
    t(last ? 'backup.reminder' : 'backup.reminderNever', { n: days }));
}
