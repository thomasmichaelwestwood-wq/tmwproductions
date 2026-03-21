// ============================================================
// TMW Productions — Live Availability Checker
// Google Apps Script (Code.gs)
//
// SETUP INSTRUCTIONS:
// 1. Go to https://script.google.com and click "New project"
// 2. Delete any existing code and paste ALL of this file in
// 3. Click Deploy > New deployment
// 4. Type: Web app
// 5. Execute as: Me (info@tmwproductions.co.uk)
// 6. Who has access: Anyone
// 7. Click Deploy and copy the Web App URL
// 8. Paste that URL into js/availability.js where it says YOUR_APPS_SCRIPT_URL_HERE
// ============================================================

function doGet(e) {
  var dateStr = e.parameter.date; // expects YYYY-MM-DD

  if (!dateStr) {
    return respond({ error: 'No date provided' });
  }

  try {
    var parts = dateStr.split('-');
    var year  = parseInt(parts[0]);
    var month = parseInt(parts[1]) - 1; // JS months are 0-indexed
    var day   = parseInt(parts[2]);

    var startOfDay = new Date(year, month, day, 0, 0, 0);
    var endOfDay   = new Date(year, month, day, 23, 59, 59);

    var calendar = CalendarApp.getCalendarById('info@tmwproductions.co.uk');
    var events   = calendar.getEvents(startOfDay, endOfDay);

    // Filter out all-day UK holidays and any event titled "Tentative"
    var bookings = events.filter(function(ev) {
      var title = ev.getTitle().toLowerCase();
      return title !== 'tentative' && !ev.isAllDayEvent();
    });

    // Also check all-day events that are actual bookings (not holidays)
    var allDay = events.filter(function(ev) {
      return ev.isAllDayEvent() && ev.getTitle().toLowerCase() !== 'tentative';
    });

    var booked = bookings.length > 0 || allDay.length > 0;

    return respond({ available: !booked });

  } catch (err) {
    return respond({ error: err.message });
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
