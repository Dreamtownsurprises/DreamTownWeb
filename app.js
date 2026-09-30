/* =====================================================
   DREAM TOWN SURPRISES
   APP.JS
===================================================== */

const { createClient } = supabase;

const db = createClient(
  window.DTS_SUPABASE_URL,
  window.DTS_SUPABASE_PUBLISHABLE_KEY
);


/* =====================================================
   GLOBAL STATE
===================================================== */

let bookings = [];

let month = new Date();
month.setDate(1);

let currentUser = null;

let availabilityDate = today();

let rangeStart = null;
let rangeEnd = null;


/* =====================================================
   HELPERS
===================================================== */

const $ = id => document.getElementById(id);

function today() {

  const d = new Date();

  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}


function fmt(date) {

  if (!date) return '';

  return new Date(
    date + 'T00:00:00'
  ).toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  );
}


function esc(value) {

  return String(value ?? '').replace(
    /[&<>'"]/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[c])
  );
}


const icons = {

  'Anniversary Surprise': '♥',

  'Birthday Surprise': '🎂',

  'Proposal Surprise': '💍',

  'Romantic Setup': '♥',

  'Welcome Surprise': '✦',

  'Custom Event': '✿'

};


function formatTime(time) {

  if (!time) return 'TBD';

  const [h, m] = time.split(':');

  const hour = Number(h);

  const suffix =
    hour >= 12
      ? 'PM'
      : 'AM';

  const displayHour =
    hour % 12 || 12;

  return `${displayHour}:${m} ${suffix}`;
}


/* =====================================================
   LOGIN
===================================================== */

function showLogin() {

  $('login').classList.remove('hidden');

  $('app').classList.add('hidden');
}


function showApp() {

  $('login').classList.add('hidden');

  $('app').classList.remove('hidden');
}


function setAuthMessage(
  message,
  error = true
) {

  $('loginError').textContent =
    message || '';

  $('loginError').style.color =
    error
      ? ''
      : '#72a879';
}


/* =====================================================
   LOGIN FORM
===================================================== */

$('loginForm').onsubmit =
  async e => {

    e.preventDefault();

    setAuthMessage(
      'Signing in…',
      false
    );

    const email =
      $('user').value.trim();

    const password =
      $('pass').value;

    const { error } =
      await db.auth.signInWithPassword({
        email,
        password
      });

    if (error) {

      setAuthMessage(
        error.message ||
        'Incorrect email or password.'
      );

      return;
    }

    await startApp();
  };


/* =====================================================
   LOGOUT
===================================================== */

$('logout').onclick =
  async () => {

    await db.auth.signOut();

    showLogin();
  };


/* =====================================================
   FORGOT PASSWORD
===================================================== */

$('forgot').onclick =
  async () => {

    const email =
      $('user').value.trim();

    if (!email) {

      setAuthMessage(
        'Enter your email first, then click Forgot password.'
      );

      return;
    }

    const { error } =
      await db.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            window.location.origin +
            window.location.pathname
        }
      );

    setAuthMessage(
      error
        ? error.message
        : 'Password reset email sent. Check your inbox.',
      !error
    );
  };


/* =====================================================
   SIGNUP
===================================================== */

$('showSignup').onclick =
  () => {

    $('loginPanel')
      .classList
      .add('hidden');

    $('signupPanel')
      .classList
      .remove('hidden');

    setAuthMessage('');
  };


$('showLogin').onclick =
  () => {

    $('signupPanel')
      .classList
      .add('hidden');

    $('loginPanel')
      .classList
      .remove('hidden');

    setAuthMessage('');
  };


$('signupForm').onsubmit =
  async e => {

    e.preventDefault();

    const name =
      $('signupName')
        .value
        .trim();

    const email =
      $('signupEmail')
        .value
        .trim();

    const password =
      $('signupPass')
        .value;

    if (password.length < 8) {

      $('signupError').textContent =
        'Password must be at least 8 characters.';

      return;
    }

    $('signupError').textContent =
      'Creating account…';

    const { data, error } =
      await db.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });

    if (error) {

      $('signupError').textContent =
        error.message;

      return;
    }

    if (data.session) {

      $('signupError').textContent =
        'Account created. Loading dashboard…';

      await startApp();

    } else {

      $('signupError').textContent =
        'Account created. Confirm your email if required, then sign in. New staff accounts must be authorized by the owner.';
    }
  };


/* =====================================================
   START APP
===================================================== */

async function startApp() {

  const {
    data: {
      user
    }
  } = await db.auth.getUser();

  if (!user) {

    showLogin();

    return;
  }


  const {
    data: staff,
    error
  } =
    await db
      .from('staff')
      .select(
        'user_id,full_name'
      )
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle();


  if (error || !staff) {

    await db.auth.signOut();

    setAuthMessage(
      'This account is not authorized for Dream Town Surprises yet. Ask the owner to add it as staff.'
    );

    showLogin();

    return;
  }


  currentUser = {

    ...user,

    full_name:
      staff.full_name ||
      user.user_metadata?.full_name ||
      'Team Member'

  };


  $('welcomeName').textContent =
    currentUser.full_name
      .split(' ')[0];


  $('profileName').textContent =
    currentUser.full_name;


  $('profileInitials').textContent =
    currentUser.full_name
      .split(/\s+/)
      .map(x => x[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();


  showApp();

  await loadBookings();

  render();
}


/* =====================================================
   LOAD BOOKINGS
===================================================== */

async function loadBookings() {

  const {
    data,
    error
  } =
    await db
      .from('bookings')
      .select('*')
      .order(
        'event_date',
        {
          ascending: true
        }
      )
      .order(
        'event_time',
        {
          ascending: true
        }
      );


  if (error) {

    console.error(error);

    alert(
      'Could not load bookings: ' +
      error.message
    );

    return;
  }


  bookings =
    (data || []).map(
      b => ({

        id: b.id,

        type:
          b.event_type,

        date:
          b.event_date,

        time:
          b.event_time || '',

        bookedBy:
          b.booked_by,

        customer:
          b.customer_name || '',

        phone:
          b.phone || '',

        status:
          b.status,

        notes:
          b.notes || ''

      })
    );
}


/* =====================================================
   SAVE BOOKING
===================================================== */

async function saveBooking() {

  const id =
    $('editId').value;


  const b = {

    type:
      $('type').value,

    date:
      $('date').value,

    time:
      $('time').value,

    bookedBy:
      $('bookedBy')
        .value
        .trim(),

    customer:
      $('customer')
        .value
        .trim(),

    phone:
      $('phone')
        .value
        .trim(),

    status:
      $('status').value,

    notes:
      $('notes')
        .value
        .trim()

  };


  if (!b.date) {

    $('formError').textContent =
      'Please select a date.';

    return;
  }


  if (!b.time) {

    $('formError').textContent =
      'Please select a time.';

    return;
  }


  /*
    IMPORTANT:
    Same date + different time is allowed.
  */

  const duplicate =
    bookings.find(
      x =>
        x.date === b.date &&
        x.time === b.time &&
        x.status !== 'Cancelled' &&
        x.id !== id
    );


  if (duplicate) {

    $('formError').textContent =
      `This date and time is already booked by ${duplicate.bookedBy}. Choose another time.`;

    return;
  }


  $('formError').textContent =
    'Saving…';


  const row = {

    event_date:
      b.date,

    event_time:
      b.time,

    event_type:
      b.type,

    booked_by:
      b.bookedBy,

    customer_name:
      b.customer || null,

    phone:
      b.phone || null,

    status:
      b.status,

    notes:
      b.notes || null

  };


  let result;


  if (id) {

    result =
      await db
        .from('bookings')
        .update(row)
        .eq('id', id)
        .select()
        .single();

  } else {

    result =
      await db
        .from('bookings')
        .insert({
          ...row,
          created_by:
            currentUser.id
        })
        .select()
        .single();
  }


  if (result.error) {

    $('formError').textContent =
      result.error.code === '23505'
        ? 'That date and time was just booked by another device. Please choose another time.'
        : result.error.message;

    return;
  }


  closeModal();

  await loadBookings();

  render();

  if (
    !$('bookings')
      .classList
      .contains('hidden')
  ) {

    renderBookings();
  }
}


$('bookingForm').onsubmit =
  e => {

    e.preventDefault();

    saveBooking();
  };


/* =====================================================
   DASHBOARD
===================================================== */

function render() {

  stats();

  calendar();

  upcoming();
}


function stats() {

  const now =
    new Date();

  const year =
    now.getFullYear();

  const monthNumber =
    String(
      now.getMonth() + 1
    ).padStart(2, '0');


  $('total').textContent =
    bookings.length;


  $('month').textContent =
    bookings.filter(
      b =>
        b.date?.startsWith(
          `${year}-${monthNumber}`
        )
    ).length;


  $('upcoming').textContent =
    bookings.filter(
      b =>
        b.date >= today() &&
        b.status !== 'Cancelled'
    ).length;


  $('customers').textContent =
    new Set(
      bookings.map(
        b =>
          b.customer ||
          b.bookedBy
      )
    ).size;
}


/* =====================================================
   MINI CALENDAR
===================================================== */

function calendar() {

  const year =
    month.getFullYear();

  const monthIndex =
    month.getMonth();

  const first =
    new Date(
      year,
      monthIndex,
      1
    ).getDay();

  const days =
    new Date(
      year,
      monthIndex + 1,
      0
    ).getDate();


  $('calTitle').textContent =
    month.toLocaleString(
      'en-IN',
      {
        month: 'long',
        year: 'numeric'
      }
    );


  let html = '';

  for (
    let i = 0;
    i < first;
    i++
  ) {

    html += '<span></span>';
  }


  for (
    let d = 1;
    d <= days;
    d++
  ) {

    const date =
      `${year}-${String(
        monthIndex + 1
      ).padStart(2, '0')}-${String(
        d
      ).padStart(2, '0')}`;


    const booked =
      bookings.some(
        x =>
          x.date === date &&
          x.status !== 'Cancelled'
      );


    html += `
      <button
        class="${booked ? 'booked ' : ''}${date === today() ? 'today' : ''}"
        onclick="openModal('${date}')"
      >
        ${d}
      </button>
    `;
  }


  $('days').innerHTML =
    html;
}


/* =====================================================
   UPCOMING
===================================================== */

function upcoming() {

  const list =
    bookings
      .filter(
        b =>
          b.date >= today() &&
          b.status !== 'Cancelled'
      )
      .sort(
        (a, b) =>
          (
            a.date +
            a.time
          ).localeCompare(
            b.date +
            b.time
          )
      )
      .slice(0, 5);


  $('upcomingList').innerHTML =
    list.length

      ? list.map(
          b => `

            <div class="booking">

              <div class="thumb">
                ${icons[b.type] || '✦'}
              </div>

              <div>

                <b>
                  ${esc(b.type)}
                </b>

                <div class="sub">
                  ${esc(
                    b.notes ||
                    'Special surprise experience'
                  )}
                </div>

              </div>

              <div class="meta">

                <b>
                  ▣ ${fmt(b.date)}
                </b>

                <br>

                ◷ ${esc(
                  formatTime(b.time)
                )}

              </div>

              <div class="meta">

                Booked by

                <br>

                <b>
                  ${esc(b.bookedBy)}
                </b>

              </div>

              <span class="badge">
                ${esc(
                  b.status ||
                  'Confirmed'
                )}
              </span>

            </div>

          `
        ).join('')

      : `
        <div class="card">
          <p>
            No upcoming bookings.
            Create your first surprise.
          </p>
        </div>
      `;
}


/* =====================================================
   PAGE NAVIGATION
===================================================== */

function page(name) {

  document
    .querySelectorAll('.page')
    .forEach(
      x =>
        x.classList.add('hidden')
    );


  $(name)
    .classList
    .remove('hidden');


  document
    .querySelectorAll('nav button')
    .forEach(
      x =>
        x.classList.toggle(
          'active',
          x.dataset.page === name
        )
    );


  if (name === 'dashboard') {

    render();
  }


  if (name === 'bookings') {

    renderBookings();
  }


  if (name === 'availability') {

    availability();
  }


  if (name === 'customers') {

    customers();
  }


  if (name === 'reports') {

    reports();
  }


  /*
    Automatically close mobile sidebar.
  */

  document
    .querySelector('aside')
    .classList
    .remove('open');
}


/* =====================================================
   NAV BUTTONS
===================================================== */

document
  .querySelectorAll('[data-page]')
  .forEach(
    button => {

      button.onclick =
        () =>
          page(
            button.dataset.page
          );
    }
  );


document
  .querySelectorAll('[data-add]')
  .forEach(
    button => {

      button.onclick =
        () =>
          openModal();
    }
  );


/* =====================================================
   MOBILE MENU
===================================================== */

$('menu').onclick =
  () => {

    document
      .querySelector('aside')
      .classList
      .toggle('open');
  };


/* =====================================================
   SEARCH
===================================================== */

$('filter').oninput =
  renderBookings;


$('search').oninput =
  e => {

    $('filter').value =
      e.target.value;

    page('bookings');
  };


/* =====================================================
   MONTH NAVIGATION
===================================================== */

$('prev').onclick =
  () => {

    month.setMonth(
      month.getMonth() - 1
    );

    calendar();
  };


$('next').onclick =
  () => {

    month.setMonth(
      month.getMonth() + 1
    );

    calendar();
  };


/* =====================================================
   BOOKING LIST
===================================================== */

function renderBookings() {

  const q =
    (
      $('filter').value ||
      ''
    )
      .toLowerCase()
      .trim();


  const results =
    bookings
      .filter(
        b => {

          const searchable = [

            b.type,

            b.bookedBy,

            b.customer,

            b.phone,

            b.date,

            b.time,

            formatTime(b.time),

            b.status

          ]
            .join(' ')
            .toLowerCase();


          return searchable.includes(q);
        }
      )
      .sort(
        (a, b) =>
          (
            a.date +
            a.time
          ).localeCompare(
            b.date +
            b.time
          )
      );


  $('allBookings').innerHTML =

    results.length

      ? results.map(
          b => `

            <div class="fullrow">

              <b>
                ${fmt(b.date)}
              </b>

              <span>

                <b>
                  ${esc(b.type)}
                </b>

                <br>

                ${esc(
                  b.customer ||
                  'No customer'
                )}

              </span>

              <span>

                ${esc(
                  b.bookedBy
                )}

                <br>

                ${esc(
                  b.phone ||
                  ''
                )}

              </span>

              <span>

                ${esc(
                  formatTime(b.time)
                )}

              </span>

              <span>

                <span class="badge">
                  ${esc(b.status)}
                </span>

              </span>

              <span class="row-actions">

                <button
                  class="mini"
                  onclick="editBooking('${b.id}')"
                >
                  Edit
                </button>

                <button
                  class="mini danger"
                  onclick="deleteBooking('${b.id}')"
                >
                  Delete
                </button>

              </span>

            </div>

          `
        ).join('')

      : `
        <div style="padding:30px;text-align:center;color:#968983;">
          No bookings found.
        </div>
      `;
}


/* =====================================================
   EDIT BOOKING
===================================================== */

window.editBooking =
  id => {

    const b =
      bookings.find(
        x => x.id === id
      );

    if (!b) return;


    openModal();


    $('editId').value =
      b.id;

    $('type').value =
      b.type;

    $('date').value =
      b.date;

    $('time').value =
      b.time;

    $('bookedBy').value =
      b.bookedBy;

    $('customer').value =
      b.customer;

    $('phone').value =
      b.phone;

    $('status').value =
      b.status;

    $('notes').value =
      b.notes;


    $('modalTitle').textContent =
      'Edit Booking';
  };


/* =====================================================
   DELETE BOOKING
===================================================== */

window.deleteBooking =
  async id => {

    const b =
      bookings.find(
        x => x.id === id
      );

    if (!b) return;


    const label =
      `${b.type} on ${fmt(b.date)} at ${formatTime(b.time)}`;


    if (
      !confirm(
        `Delete this booking?\n\n${label}\n\nThis action cannot be undone.`
      )
    ) {

      return;
    }


    const {
      error
    } =
      await db
        .from('bookings')
        .delete()
        .eq('id', id);


    if (error) {

      alert(
        'Could not delete booking: ' +
        error.message
      );

      return;
    }


    await loadBookings();

    render();

    renderBookings();
  };


/* =====================================================
   BOOKING MODAL
===================================================== */

function openModal(date = '') {

  $('bookingForm').reset();

  $('editId').value = '';

  $('modal')
    .classList
    .remove('hidden');


  $('date').value =
    date ||
    today();


  $('modalTitle').textContent =
    'Create New Booking';


  $('formError').textContent =
    '';
}


function closeModal() {

  $('modal')
    .classList
    .add('hidden');
}


$('close').onclick =
  closeModal;


$('cancelModal').onclick =
  closeModal;


/* =====================================================
   AVAILABILITY
===================================================== */

function availability() {

  rangeStart = null;

  rangeEnd = null;

  availabilityDate =
    today();


  renderAvailabilityDates();

  renderAvailabilitySlots(
    availabilityDate
  );
}


/* =====================================================
   DATE STRIP
===================================================== */

function renderAvailabilityDates() {

  const dates = [];


  for (
    let i = 0;
    i < 14;
    i++
  ) {

    const d =
      new Date();

    d.setHours(
      0,
      0,
      0,
      0
    );

    d.setDate(
      d.getDate() + i
    );


    const s =
      d.getFullYear() +
      '-' +
      String(
        d.getMonth() + 1
      ).padStart(2, '0') +
      '-' +
      String(
        d.getDate()
      ).padStart(2, '0');


    const weekday =
      d.toLocaleDateString(
        'en-IN',
        {
          weekday: 'short'
        }
      ).toUpperCase();


    const day =
      d.getDate();


    const monthName =
      d.toLocaleDateString(
        'en-IN',
        {
          month: 'short'
        }
      );


    const selected =
      s === availabilityDate;


    dates.push(`

      <button
        class="availability-date ${selected ? 'selected' : ''}"
        onclick="selectAvailabilityDate('${s}')"
      >

        <span class="avail-weekday">
          ${weekday}
        </span>

        <strong>
          ${day}
        </strong>

        <span class="avail-month">
          ${monthName}
        </span>

      </button>

    `);
  }


  $('availDays').innerHTML =
    dates.join('');
}


/* =====================================================
   SELECT DATE
===================================================== */

window.selectAvailabilityDate =
  function(date) {

    availabilityDate =
      date;

    rangeStart = null;

    rangeEnd = null;


    renderAvailabilityDates();

    renderAvailabilitySlots(
      date
    );
  };


/* =====================================================
   TIME HELPERS
===================================================== */

function timeToMinutes(time) {

  const [
    h,
    m
  ] =
    time
      .split(':')
      .map(Number);

  return (
    h * 60 +
    m
  );
}


function minutesToTime(minutes) {

  const h =
    Math.floor(
      minutes / 60
    );

  const m =
    minutes % 60;


  return (
    String(h).padStart(2, '0') +
    ':' +
    String(m).padStart(2, '0')
  );
}


function formatAvailabilityTime(time) {

  return formatTime(time);
}


/* =====================================================
   PAST TIME
===================================================== */

function isPastTime(
  date,
  time
) {

  if (
    date !== today()
  ) {

    return false;
  }


  const now =
    new Date();


  const currentMinutes =
    now.getHours() * 60 +
    now.getMinutes();


  return (
    timeToMinutes(time) <=
    currentMinutes
  );
}


/* =====================================================
   BOOKED TIME
===================================================== */

function isTimeBooked(
  date,
  time
) {

  const target =
    timeToMinutes(time);


  return bookings.some(
    b => {

      if (
        b.date !== date ||
        b.status === 'Cancelled'
      ) {

        return false;
      }


      if (!b.time) {

        return false;
      }


      return (
        timeToMinutes(
          b.time
        ) === target
      );
    }
  );
}


/* =====================================================
   RANGE
===================================================== */

function isInSelectedRange(
  time
) {

  if (!rangeStart) {

    return false;
  }


  const current =
    timeToMinutes(time);

  const start =
    timeToMinutes(rangeStart);


  if (!rangeEnd) {

    return current === start;
  }


  const end =
    timeToMinutes(rangeEnd);


  return (
    current >= start &&
    current <= end
  );
}


/* =====================================================
   RENDER TIME SLOTS
===================================================== */

function renderAvailabilitySlots(
  date
) {

  const slots = [];


  /*
    9:00 AM → 9:00 PM
  */

  for (
    let minutes = 9 * 60;
    minutes <= 21 * 60;
    minutes += 30
  ) {

    const time =
      minutesToTime(
        minutes
      );


    const past =
      isPastTime(
        date,
        time
      );


    const booked =
      isTimeBooked(
        date,
        time
      );


    const selected =
      isInSelectedRange(
        time
      );


    let classes =
      'availability-slot';


    if (past)
      classes += ' past';


    if (booked)
      classes += ' booked';


    if (selected)
      classes += ' selected';


    if (
      rangeStart &&
      rangeEnd &&
      timeToMinutes(time) ===
        timeToMinutes(rangeStart)
    ) {

      classes +=
        ' range-start';
    }


    if (
      rangeStart &&
      rangeEnd &&
      timeToMinutes(time) ===
        timeToMinutes(rangeEnd)
    ) {

      classes +=
        ' range-end';
    }


    const disabled =
      past ||
      booked;


    slots.push(`

      <button

        class="${classes}"

        ${disabled ? 'disabled' : ''}

        onclick="selectAvailabilityTime('${time}')"

      >

        ${formatAvailabilityTime(time)}

      </button>

    `);
  }


  $('availInfo').innerHTML = `

    <div class="availability-header">

      <div>

        <div class="availability-eyebrow">
          LIVE AVAILABILITY
        </div>

        <h2>
          Pick a date and time range
        </h2>

        <p class="availability-subtitle">
          Availability updates automatically every few seconds.
        </p>

      </div>

    </div>


    <div class="availability-instruction">

      Tap a time to start, then tap another to set how long you need.
      Stay 3–4 hours if your event needs it.

    </div>


    <div class="availability-slots">

      ${slots.join('')}

    </div>


    <div class="availability-help">

      Slots run in 30-minute steps (minimum 1 hour).
      Pick a continuous run as many as you need,
      then fill in your details below.
      Once a range is booked it's held exclusively for you.

    </div>


    ${
      rangeStart
        ? `

          <div class="availability-selection">

            <div>

              <span>
                SELECTED START
              </span>

              <strong>
                ${formatAvailabilityTime(rangeStart)}
              </strong>

            </div>


            ${
              rangeEnd
                ? `

                  <div>

                    <span>
                      SELECTED END
                    </span>

                    <strong>
                      ${formatAvailabilityTime(rangeEnd)}
                    </strong>

                  </div>

                  <button
                    class="availability-book-btn"
                    onclick="bookSelectedAvailability()"
                  >
                    Book this time →
                  </button>

                `
                : `

                  <div>

                    <span>
                      NEXT STEP
                    </span>

                    <strong>
                      Select end time
                    </strong>

                  </div>

                `
            }

          </div>

        `
        : ''
    }

  `;
}


/* =====================================================
   SELECT TIME
===================================================== */

window.selectAvailabilityTime =
  function(time) {

    /*
      First click = start.
    */

    if (!rangeStart) {

      rangeStart =
        time;

      rangeEnd =
        null;

      renderAvailabilitySlots(
        availabilityDate
      );

      return;
    }


    /*
      Clicking before start
      creates a new start.
    */

    if (
      timeToMinutes(time) <
      timeToMinutes(rangeStart)
    ) {

      rangeStart =
        time;

      rangeEnd =
        null;

      renderAvailabilitySlots(
        availabilityDate
      );

      return;
    }


    /*
      Second click = end.
    */

    rangeEnd =
      time;


    /*
      Minimum 1 hour.
    */

    const duration =
      timeToMinutes(rangeEnd) -
      timeToMinutes(rangeStart);


    if (
      duration < 60
    ) {

      rangeEnd =
        null;

      renderAvailabilitySlots(
        availabilityDate
      );

      alert(
        'Please select at least 1 hour.'
      );

      return;
    }


    /*
      Check every slot
      inside range.
    */

    const start =
      timeToMinutes(
        rangeStart
      );

    const end =
      timeToMinutes(
        rangeEnd
      );


    for (
      let t = start;
      t <= end;
      t += 30
    ) {

      const slot =
        minutesToTime(t);


      if (
        isTimeBooked(
          availabilityDate,
          slot
        )
      ) {

        rangeEnd =
          null;

        renderAvailabilitySlots(
          availabilityDate
        );

        alert(
          'This range contains a booked time. Please choose another range.'
        );

        return;
      }
    }


    renderAvailabilitySlots(
      availabilityDate
    );
  };


/* =====================================================
   BOOK SELECTED RANGE
===================================================== */

window.bookSelectedAvailability =
  function() {

    if (
      !rangeStart ||
      !rangeEnd
    ) {

      return;
    }


    openModal(
      availabilityDate
    );


    $('time').value =
      rangeStart;


    $('time').dataset.endTime =
      rangeEnd;


    $('formError').textContent =
      `Selected time: ${formatAvailabilityTime(rangeStart)} – ${formatAvailabilityTime(rangeEnd)}`;
  };


/* =====================================================
   CUSTOMERS
===================================================== */

function customers() {

  const map = {};


  bookings.forEach(
    b => {

      const key =
        b.customer ||
        b.phone ||
        b.bookedBy;


      if (!map[key]) {

        map[key] = {

          name:
            b.customer ||
            b.bookedBy,

          phone:
            b.phone,

          count: 0

        };
      }


      map[key].count++;
    }
  );


  $('customerGrid').innerHTML =

    Object.values(map)
      .map(
        c => `

          <div class="customer">

            <h3>
              ${esc(c.name)}
            </h3>

            <p>
              ${esc(
                c.phone ||
                'No phone added'
              )}
            </p>

            <b>
              ${c.count} booking(s)
            </b>

          </div>

        `
      )
      .join('')

      ||

      `
        <div class="card">
          No customers yet.
        </div>
      `;
}


/* =====================================================
   REPORTS
===================================================== */

function reports() {

  $('reportsGrid').innerHTML = `

    <article>

      <b>
        ${bookings.length}
      </b>

      <span>
        Total Bookings
      </span>

    </article>


    <article>

      <b>
        ${
          bookings.filter(
            x =>
              x.status ===
              'Confirmed'
          ).length
        }
      </b>

      <span>
        Confirmed
      </span>

    </article>


    <article>

      <b>
        ${
          bookings.filter(
            x =>
              x.status ===
              'Pending'
          ).length
        }
      </b>

      <span>
        Pending
      </span>

    </article>

  `;
}


/* =====================================================
   AUTH SECURITY
===================================================== */

(async () => {

  /*
    Force login when opening
    a new page.
  */

  await db.auth.signOut();

  showLogin();


  db.auth.onAuthStateChange(
    async (
      event,
      session
    ) => {

      if (
        event ===
        'SIGNED_IN' &&
        session
      ) {

        await startApp();
      }


      if (
        event ===
        'SIGNED_OUT'
      ) {

        showLogin();
      }

    }
  );

})();
