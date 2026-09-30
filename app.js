const { createClient } = supabase;

const db = createClient(
  window.DTS_SUPABASE_URL,
  window.DTS_SUPABASE_PUBLISHABLE_KEY
);

let bookings = [];
let month = new Date();

month.setDate(1);

let currentUser = null;

let selectedAvailabilityDate = null;
let selectedAvailabilityTime = null;

const $ = x => document.getElementById(x);

const today = () =>
  new Date().toISOString().slice(0, 10);

const fmt = s =>
  new Date(s + 'T00:00').toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  );

const esc = v =>
  String(v ?? '').replace(
    /[&<>'"]/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[c])
  );

const icons = {
  'Anniversary Surprise': '♥',
  'Birthday Surprise': '🎂',
  'Proposal Surprise': '💍',
  'Romantic Setup': '♥',
  'Welcome Surprise': '✦',
  'Custom Event': '✿'
};


/* =========================================================
   TIME FORMAT
========================================================= */

function formatTime(time) {

  if (!time) return 'TBD';

  const [h, m] = time.split(':');

  const hour = Number(h);

  const suffix = hour >= 12 ? 'PM' : 'AM';

  const displayHour = hour % 12 || 12;

  return `${displayHour}:${m} ${suffix}`;
}


/* =========================================================
   LOGIN
========================================================= */

function showLogin() {

  $('login').classList.remove('hidden');

  $('app').classList.add('hidden');

}


function showApp() {

  $('login').classList.add('hidden');

  $('app').classList.remove('hidden');

}


function setAuthMessage(
  msg,
  error = true
) {

  $('loginError').textContent =
    msg || '';

  $('loginError').style.color =
    error ? '' : '#5f7d61';
}


/* =========================================================
   LOGIN FORM
========================================================= */

$('loginForm').onsubmit = async e => {

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


/* =========================================================
   LOGOUT
========================================================= */

$('logout').onclick =
  async () => {

    await db.auth.signOut();

    showLogin();

  };


/* =========================================================
   FORGOT PASSWORD
========================================================= */

$('forgot').onclick =
  async () => {

    const email =
      $('user').value.trim();

    if (!email) {

      setAuthMessage(
        'Enter your email first.'
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


/* =========================================================
   SIGNUP
========================================================= */

$('showSignup').onclick = () => {

  $('loginPanel')
    .classList
    .add('hidden');

  $('signupPanel')
    .classList
    .remove('hidden');

  setAuthMessage('');
};


$('showLogin').onclick = () => {

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
      $('signupName').value.trim();

    const email =
      $('signupEmail').value.trim();

    const password =
      $('signupPass').value;

    if (password.length < 8) {

      $('signupError').textContent =
        'Password must be at least 8 characters.';

      return;
    }

    $('signupError').textContent =
      'Creating account…';

    const {
      data,
      error
    } =
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
        'Account created. Confirm your email first, then sign in. New staff accounts must be authorized by the owner in Supabase.';

    }
  };


/* =========================================================
   START APP
========================================================= */

async function startApp() {

  const {
    data: {
      user
    }
  } =
    await db.auth.getUser();

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


/* =========================================================
   LOAD BOOKINGS
========================================================= */

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
    (data || []).map(b => ({
      id: b.id,

      type: b.event_type,

      date: b.event_date,

      time:
        b.event_time
          ? String(b.event_time).slice(0, 5)
          : '',

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
    }));

}


/* =========================================================
   SAVE BOOKING
   IMPORTANT:
   SAME DATE + DIFFERENT TIME = ALLOWED
========================================================= */

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
      $('bookedBy').value.trim(),

    customer:
      $('customer').value.trim(),

    phone:
      $('phone').value.trim(),

    status:
      $('status').value,

    notes:
      $('notes').value.trim()

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
     FIXED:
     We now compare BOTH date AND time.
  */

  const duplicate =
    bookings.find(x =>

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

    if (
      result.error.code ===
      '23505'
    ) {

      $('formError').textContent =
        'That exact date and time was just booked. Please choose another time.';

    } else {

      $('formError').textContent =
        result.error.message;

    }

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


/* =========================================================
   BOOKING FORM
========================================================= */

$('bookingForm').onsubmit =
  e => {

    e.preventDefault();

    saveBooking();

  };


/* =========================================================
   DASHBOARD
========================================================= */

function render() {

  stats();

  calendar();

  upcoming();

}


function stats() {

  const y =
    new Date().getFullYear();

  const m =
    String(
      new Date().getMonth() + 1
    ).padStart(2, '0');


  $('total').textContent =
    bookings.length;


  $('month').textContent =
    bookings.filter(
      b =>
        b.date?.startsWith(
          y + '-' + m
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


/* =========================================================
   DASHBOARD CALENDAR
========================================================= */

function calendar() {

  const y =
    month.getFullYear();

  const m =
    month.getMonth();

  const first =
    new Date(
      y,
      m,
      1
    ).getDay();

  const days =
    new Date(
      y,
      m + 1,
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


  let h =
    '<span></span>'.repeat(
      first
    );


  for (
    let d = 1;
    d <= days;
    d++
  ) {

    const s =
      `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;


    const booked =
      bookings.some(
        x =>
          x.date === s &&
          x.status !== 'Cancelled'
      );


    h += `
      <button
        class="${booked ? 'booked ' : ''}${s === today() ? 'today' : ''}"
        onclick="openModal('${s}')"
      >
        ${d}
      </button>
    `;

  }


  $('days').innerHTML = h;

}


/* =========================================================
   UPCOMING
========================================================= */

function upcoming() {

  const a =
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
    a.length

      ? a.map(
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
        <p>
          No upcoming bookings.
          Create your first surprise.
        </p>
      `;

}


/* =========================================================
   NAVIGATION
========================================================= */

function page(n) {

  document
    .querySelectorAll('.page')
    .forEach(
      x =>
        x.classList.add(
          'hidden'
        )
    );


  $(n).classList.remove(
    'hidden'
  );


  document
    .querySelectorAll(
      'nav button'
    )
    .forEach(
      x =>
        x.classList.toggle(
          'active',
          x.dataset.page === n
        )
    );


  if (
    n === 'bookings'
  ) {

    renderBookings();

  }


  if (
    n === 'availability'
  ) {

    availability();

  }


  if (
    n === 'customers'
  ) {

    customers();

  }


  if (
    n === 'reports'
  ) {

    reports();

  }


  /* Mobile sidebar closes after selection */

  if (
    window.innerWidth <= 900
  ) {

    document
      .querySelector('aside')
      ?.classList
      .remove('open');

  }

}


/* =========================================================
   BOOKINGS SEARCH
   PHONE NUMBER INCLUDED
========================================================= */

function renderBookings() {

  const q =
    (
      $('filter').value ||
      ''
    )
      .toLowerCase()
      .trim();


  const filtered =
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

    filtered.length

      ? filtered.map(
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
                  formatTime(
                    b.time
                  )
                )}

              </span>

              <span class="badge">

                ${esc(
                  b.status
                )}

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
        <p>
          No bookings found.
        </p>
      `;

}


/* =========================================================
   EDIT BOOKING
========================================================= */

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


/* =========================================================
   DELETE BOOKING
========================================================= */

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


    if (
      !$('bookings')
        .classList
        .contains('hidden')
    ) {

      renderBookings();

    }

  };


/* =========================================================
   MODAL
========================================================= */

function openModal(
  date = '',
  time = ''
) {

  $('bookingForm').reset();

  $('editId').value = '';

  $('modal')
    .classList
    .remove('hidden');


  $('date').value =
    date || today();


  $('time').value =
    time || '';


  $('modalTitle').textContent =
    'Create New Booking';


  $('formError').textContent =
    '';

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeModal() {

  $('modal')
    .classList
    .add('hidden');

}


$('close').onclick =
  closeModal;


/* =========================================================
   SEARCH
========================================================= */

$('filter').oninput =
  renderBookings;


$('search').oninput =
  e => {

    $('filter').value =
      e.target.value;

    page('bookings');

  };


/* =========================================================
   CALENDAR MONTH NAVIGATION
========================================================= */

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


/* =========================================================
   MOBILE MENU
========================================================= */

$('menu').onclick =
  () => {

    document
      .querySelector('aside')
      ?.classList
      .toggle('open');

  };


/* =========================================================
   NAV BUTTONS
========================================================= */

document
  .querySelectorAll(
    '[data-page]'
  )
  .forEach(
    b =>
      b.onclick =
        () =>
          page(
            b.dataset.page
          )
  );


document
  .querySelectorAll(
    '[data-add]'
  )
  .forEach(
    b =>
      b.onclick =
        () =>
          openModal()
  );


/* =========================================================
   AVAILABILITY
   SCREENSHOT-STYLE DATE + TIME SELECTION
========================================================= */

function availability() {

  renderAvailabilityDates();

}


/* =========================================================
   AVAILABILITY DATE STRIP
========================================================= */

function renderAvailabilityDates() {

  const container =
    $('availDays');


  if (!container) return;


  if (!selectedAvailabilityDate) {

    selectedAvailabilityDate =
      today();

  }


  let html = '';


  for (
    let i = 0;
    i < 14;
    i++
  ) {

    const d =
      new Date();


    d.setDate(
      d.getDate() + i
    );


    const date =
      d.toISOString()
        .slice(0, 10);


    const day =
      d.toLocaleDateString(
        'en-IN',
        {
          weekday: 'short'
        }
      );


    const number =
      d.getDate();


    const monthName =
      d.toLocaleDateString(
        'en-IN',
        {
          month: 'short'
        }
      );


    const active =
      date ===
      selectedAvailabilityDate;


    html += `

      <button
        class="availability-date ${active ? 'selected' : ''}"
        onclick="selectAvailabilityDate('${date}')"
      >

        <small>
          ${day}
        </small>

        <strong>
          ${number}
        </strong>

        <span>
          ${monthName}
        </span>

      </button>

    `;

  }


  container.innerHTML =
    html;


  showDate(
    selectedAvailabilityDate
  );

}


/* =========================================================
   SELECT DATE
========================================================= */

window.selectAvailabilityDate =
  date => {

    selectedAvailabilityDate =
      date;

    selectedAvailabilityTime =
      null;

    renderAvailabilityDates();

  };


/* =========================================================
   TIME SLOTS
   30 MINUTES
========================================================= */

function generateTimeSlots() {

  const slots = [];


  /*
     9:00 AM → 9:30 PM
  */

  for (
    let minutes = 9 * 60;
    minutes <= 21 * 60;
    minutes += 30
  ) {

    const h =
      Math.floor(
        minutes / 60
      );

    const m =
      minutes % 60;


    const value =
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;


    slots.push(value);

  }


  return slots;

}


/* =========================================================
   SHOW DATE / TIME AVAILABILITY
========================================================= */

window.showDate =
  date => {

    selectedAvailabilityDate =
      date;


    const dateBookings =
      bookings.filter(
        b =>
          b.date === date &&
          b.status !== 'Cancelled'
      );


    const info =
      $('availInfo');


    if (!info) return;


    const slots =
      generateTimeSlots();


    const available =
      slots.filter(
        time =>
          !dateBookings.some(
            b =>
              b.time === time
          )
      );


    const slotHTML =
      slots.map(
        time => {

          const booked =
            dateBookings.some(
              b =>
                b.time === time
            );


          const selected =
            selectedAvailabilityTime ===
            time;


          return `

            <button
              class="
                availability-time
                ${booked ? 'booked' : ''}
                ${selected ? 'selected' : ''}
              "
              ${booked ? 'disabled' : ''}
              onclick="selectAvailabilityTime('${date}','${time}')"
            >

              ${formatTime(time)}

            </button>

          `;

        }
      ).join('');


    info.innerHTML = `

      <div class="availability-detail">

        <div class="availability-detail-header">

          <div>

            <small>
              SELECTED DATE
            </small>

            <h2>
              ${fmt(date)}
            </h2>

          </div>

          <div class="availability-count">

            ${available.length}
            available

          </div>

        </div>


        <p class="availability-help">

          Tap a time to select your event.
          Booked times are automatically disabled.

        </p>


        <div class="availability-times">

          ${slotHTML}

        </div>


        ${
          dateBookings.length

            ? `

              <div class="existing-bookings">

                <small>
                  BOOKED TIMES
                </small>

                ${dateBookings
                  .sort(
                    (a,b) =>
                      a.time.localeCompare(
                        b.time
                      )
                  )
                  .map(
                    b => `

                      <div class="existing-booking">

                        <span>
                          ${formatTime(b.time)}
                        </span>

                        <div>

                          <b>
                            ${esc(b.type)}
                          </b>

                          <small>
                            Booked by
                            ${esc(b.bookedBy)}
                          </small>

                        </div>

                      </div>

                    `
                  )
                  .join('')}

              </div>

            `

            : ''
        }


        ${
          selectedAvailabilityTime

            ? `

              <div class="availability-selected">

                <span>
                  SELECTED SLOT
                </span>

                <strong>
                  ${fmt(date)}
                  ·
                  ${formatTime(
                    selectedAvailabilityTime
                  )}
                </strong>

                <button
                  class="create"
                  onclick="openModal('${date}','${selectedAvailabilityTime}')"
                >
                  Book this time →
                </button>

              </div>

            `

            : `

              <div class="availability-empty">

                Select an available time above
                to continue.

              </div>

            `
        }

      </div>

    `;

  };


/* =========================================================
   SELECT TIME
========================================================= */

window.selectAvailabilityTime =
  (
    date,
    time
  ) => {

    const duplicate =
      bookings.find(
        b =>
          b.date === date &&
          b.time === time &&
          b.status !== 'Cancelled'
      );


    if (duplicate) {

      return;

    }


    selectedAvailabilityDate =
      date;

    selectedAvailabilityTime =
      time;


    showDate(date);

  };


/* =========================================================
   CUSTOMERS
========================================================= */

function customers() {

  let m = {};


  bookings.forEach(
    b => {

      const k =
        b.customer ||
        b.bookedBy;


      m[k] ??= {

        name: k,

        phone:
          b.phone,

        count: 0

      };


      m[k].count++;

    }
  );


  $('customerGrid').innerHTML =

    Object.values(m)
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
              ${c.count}
              booking(s)
            </b>

          </div>

        `
      )
      .join('')

      ||

      '<div class="card">No customers yet.</div>';

}


/* =========================================================
   REPORTS
========================================================= */

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


/* =========================================================
   GOOGLE MAPS LOCATION
========================================================= */

function updateGoogleMapsLink() {

  const mapURL =
    'https://maps.app.goo.gl/jqkK89DXL6SXFtKn7';


  /*
     If your HTML already has a Google Maps
     link, this updates it automatically.
  */

  document
    .querySelectorAll(
      'a'
    )
    .forEach(
      a => {

        const text =
          (
            a.textContent ||
            ''
          )
            .toLowerCase();


        if (
          text.includes(
            'google maps'
          ) ||
          text.includes(
            'open in maps'
          )
        ) {

          a.href =
            mapURL;

          a.target =
            '_blank';

          a.rel =
            'noopener';

        }

      }
    );

}


/* =========================================================
   SECURITY GATE
========================================================= */

(async () => {

  /*
     Require explicit login
     on a fresh page load.
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

        updateGoogleMapsLink();

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
