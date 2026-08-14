export const getLocalTodayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isCancelable = (dateStr: string): boolean => {
  return dateStr > getLocalTodayString();
};

export const isAppointmentElapsed = (dateStr: string, timeStr: string): boolean => {
  if (!dateStr) return false;

  const today = getLocalTodayString();
  if (dateStr < today) return true;
  if (dateStr > today) return false;

  // Same day, check time slot.
  if (!timeStr) return false;

  // Check if range exists e.g. "09:00 AM - 09:30 AM" or "09:00 - 09:30 AM"
  const parts = timeStr.split('-').map((s) => s.trim());
  let targetTimeStr = parts.length > 1 ? parts[1] : parts[0];

  // If targetTimeStr doesn't have AM/PM but parts[1] had it or timeStr has it, append AM/PM if missing
  if (!/AM|PM/i.test(targetTimeStr) && /AM|PM/i.test(timeStr)) {
    const ampmMatch = timeStr.match(/AM|PM/i);
    if (ampmMatch) {
      targetTimeStr += ` ${ampmMatch[0]}`;
    }
  }

  const match = targetTimeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return false;

  let hours = parseInt(match[1], 10);
  let minutes = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  // If single time (no end time range specified in timeSlot), add 30 min duration buffer
  if (parts.length === 1) {
    minutes += 30;
    if (minutes >= 60) {
      hours += Math.floor(minutes / 60);
      minutes = minutes % 60;
    }
  }

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  if (currentHours > hours) return true;
  if (currentHours === hours && currentMinutes >= minutes) return true;

  return false;
};
