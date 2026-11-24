export function rigaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Riga', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function getUpcomingEvents(records, language, today) {
  const unique = [...new Map(records.map(record => [record.record_id, record])).values()];
  return unique.filter(record => {
    const day = (record.event_date || '').slice(0, 10);
    return record.language === language && record.status === 'published'
      && ['event', 'seminar'].includes(record.content_type)
      && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day))
      && day >= today;
  }).sort((a, b) => Number(Boolean(b.featured || b.pinned)) - Number(Boolean(a.featured || a.pinned))
    || a.event_date.localeCompare(b.event_date)
    || (a.event_time || '').localeCompare(b.event_time || '')
    || a.record_id.localeCompare(b.record_id));
}
