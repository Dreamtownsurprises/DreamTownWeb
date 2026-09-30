// =====================================================
// app.js
// DREAM TOWN SURPRISES
// =====================================================

const db = window.supabase.createClient(
  window.DTS_SUPABASE_URL,
  window.DTS_SUPABASE_PUBLISHABLE_KEY
);


/* =====================================================
   GLOBAL
===================================================== */

let currentUser = null;
let staffProfile = null;
let bookings = [];

let calendarDate = new Date();

let selectedAvailabilityDate = null;
let selectedStartTime = null;
let selectedEndTime = null;


/* =====================================================
   HELPER
===================================================== */

const $ = id =>
  document.getElementById(id);


function escapeHTML(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =====================================================
   DATE HELPERS
===================================================== */

function getLocalDateString() {

  const date = new Date();

  return [
    date.getFullYear(),

    String(
      date.getMonth() + 1
    ).padStart(2, "0"),

    String(
      date.getDate()
    ).padStart(2, "0")

  ].join("-");
}


function getPreviousDateString(dateString) {

  const date =
    new Date(
      dateString +
      "T00:00:00"
    );

  date.setDate(
    date.getDate() - 1
  );

  return [
    date.getFullYear(),

    String(
      date.getMonth() + 1
    ).padStart(2, "0"),

    String(
      date.getDate()
    ).padStart(2, "0")

  ].join("-");
}


function getNextDateString(dateString) {

  const date =
    new Date(
      dateString +
      "T00:00:00"
    );

  date.setDate(
    date.getDate() + 1
  );

  return [
    date.getFullYear(),

    String(
      date.getMonth() + 1
    ).padStart(2, "0"),

    String(
      date.getDate()
    ).padStart(2, "0")

  ].join("-");
}


function formatDate(dateString) {

  if (!dateString) {
    return "";
  }

  const date =
    new Date(
      dateString +
      "T00:00:00"
    );

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}


/* =====================================================
   TIME HELPERS
===================================================== */

function timeToMinutes(time) {

  if (!time) {
    return 0;
  }

  const parts =
    time.split(":");

  return (
    Number(parts[0]) * 60 +
    Number(parts[1] || 0)
  );
}


function minutesToTime(minutes) {

  minutes =
    minutes % 1440;

  if (minutes < 0) {
    minutes += 1440;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  const mins =
    minutes % 60;

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(mins).padStart(2, "0")
  );
}


/*
  Database:
  24-hour format

  Display:
  12-hour AM/PM
*/

function formatTime(time) {

  if (!time) {
    return "TBD";
  }

  const parts =
    time.split(":");

  const hour =
    Number(parts[0]);

  const minute =
    String(
      parts[1] || "00"
    ).padStart(2, "0");

  const period =
    hour >= 12
      ? "PM"
      : "AM";

  const displayHour =
    hour % 12 || 12;

  return (
    `${displayHour}:${minute} ${period}`
  );
}


function formatTimeRange(
  start,
  end
) {

  if (!start) {
    return "TBD";
  }

  if (!end) {
    return formatTime(start);
  }

  return (
    `${formatTime(start)} – ${formatTime(end)}`
  );
}


/* =====================================================
   OVERLAP CHECK
===================================================== */

function timeRangesOverlap(
  startA,
  endA,
  startB,
  endB
) {

  if (
    !startA ||
    !endA ||
    !startB ||
    !endB
  ) {
    return false;
  }

  let aStart =
    timeToMinutes(startA);

  let aEnd =
    timeToMinutes(endA);

  let bStart =
    timeToMinutes(startB);

  let bEnd =
    timeToMinutes(endB);


  /*
    Overnight booking.

    Example:
    10:30 PM → 1:15 AM
  */

  if (aEnd <= aStart) {
    aEnd += 1440;
  }

  if (bEnd <= bStart) {
    bEnd += 1440;
  }


  return (
    aStart < bEnd &&
    aEnd > bStart
  );
}


/* =====================================================
   GREETING
===================================================== */

function updateGreeting() {

  const greeting =
    $("greeting");

  if (!greeting) {
    return;
  }

  const hour =
    new Date().getHours();

  let text;


  if (
    hour >= 5 &&
    hour < 12
  ) {

    text =
      "GOOD MORNING";

  }

  else if (
    hour >= 12 &&
    hour < 17
  ) {

    text =
      "GOOD AFTERNOON";

  }

  else if (
    hour >= 17 &&
    hour < 21
  ) {

    text =
      "GOOD EVENING";

  }

  else {

    text =
      "GOOD NIGHT";

  }


  greeting.textContent =
    text;
}


updateGreeting();


setInterval(
  updateGreeting,
  60 * 1000
);


/* =====================================================
   AUTH UI
===================================================== */

function showLogin() {

  $("login")
    ?.classList
    .remove("hidden");

  $("app")
    ?.classList
    .add("hidden");
}


function showApp() {

  $("login")
    ?.classList
    .add("hidden");

  $("app")
    ?.classList
    .remove("hidden");
}


function showLoginPanel() {

  $("loginPanel")
    ?.classList
    .remove("hidden");

  $("signupPanel")
    ?.classList
    .add("hidden");
}


function showSignupPanel() {

  $("loginPanel")
    ?.classList
    .add("hidden");

  $("signupPanel")
    ?.classList
    .remove("hidden");
}


/* =====================================================
   AUTH INITIALIZATION
===================================================== */

async function initializeAuth() {

  /*
    Fresh login on page load.
  */

  await db.auth.signOut();

  showLogin();


  db.auth.onAuthStateChange(
    async (
      event,
      session
    ) => {

      if (
        event === "SIGNED_IN" &&
        session
      ) {

        await handleSignedIn(
          session.user
        );

      }


      if (
        event === "SIGNED_OUT"
      ) {

        currentUser = null;

        staffProfile = null;

        bookings = [];

        showLogin();

      }

    }
  );
}


async function handleSignedIn(
  user
) {

  currentUser =
    user;


  const {
    data,
    error
  } =
    await db
      .from("staff")
      .select(
        "user_id,full_name"
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();


  if (error) {

    console.error(error);

    await db.auth.signOut();

    if ($("loginError")) {

      $("loginError").textContent =
        "Unable to verify your account.";

    }

    return;
  }


  if (!data) {

    await db.auth.signOut();

    if ($("loginError")) {

      $("loginError").textContent =
        "Your account is not approved for this dashboard.";

    }

    return;
  }


  staffProfile =
    data;


  showApp();


  const name =
    data.full_name ||
    user.email?.split("@")[0] ||
    "Admin";


  if ($("profileName")) {

    $("profileName").textContent =
      name;

  }


  if ($("welcomeName")) {

    $("welcomeName").textContent =
      name;

  }


  if ($("profileInitials")) {

    $("profileInitials").textContent =
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(
          x => x[0]
        )
        .join("")
        .toUpperCase() ||
      "DT";

  }


  await loadBookings();

  renderAll();

  updateGreeting();
}


/* =====================================================
   LOGIN
===================================================== */

$("loginForm")
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      $("loginError").textContent =
        "Signing in…";


      const email =
        $("user")
          .value
          .trim();


      const password =
        $("pass")
          .value;


      const {
        data,
        error
      } =
        await db.auth.signInWithPassword({

          email,
          password

        });


      if (error) {

        $("loginError").textContent =
          error.message;

        return;
      }


      await handleSignedIn(
        data.user
      );

    }
  );


$("logout")
  ?.addEventListener(
    "click",
    async () => {

      await db.auth.signOut();

    }
  );


$("showSignup")
  ?.addEventListener(
    "click",
    showSignupPanel
  );


$("showLogin")
  ?.addEventListener(
    "click",
    showLoginPanel
  );


/* =====================================================
   FORGOT PASSWORD
===================================================== */

$("forgot")
  ?.addEventListener(
    "click",
    async () => {

      const email =
        $("user")
          .value
          .trim();


      if (!email) {

        $("loginError").textContent =
          "Enter your email first.";

        return;
      }


      const redirect =
        window.location.origin +
        window.location.pathname;


      const {
        error
      } =
        await db.auth.resetPasswordForEmail(
          email,
          {
            redirectTo:
              redirect
          }
        );


      $("loginError").textContent =
        error
          ? error.message
          : "Password reset email sent.";

    }
  );


/* =====================================================
   SIGN UP
===================================================== */

$("signupForm")
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const name =
        $("signupName")
          .value
          .trim();


      const email =
        $("signupEmail")
          .value
          .trim();


      const password =
        $("signupPass")
          .value;


      if (
        password.length < 8
      ) {

        $("signupError").textContent =
          "Password must contain at least 8 characters.";

        return;
      }


      $("signupError").textContent =
        "Creating account…";


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

        $("signupError").textContent =
          error.message;

        return;
      }


      if (data.user) {

        $("signupError").textContent =
          "Account created. Ask the owner to approve your account.";

        $("signupForm")
          .reset();

      }

    }
  );


/* =====================================================
   LOAD BOOKINGS
===================================================== */

async function loadBookings() {

  if (!currentUser) {
    return;
  }


  const {
    data,
    error
  } =
    await db
      .from("bookings")
      .select("*")
      .order(
        "event_date",
        {
          ascending: true
        }
      )
      .order(
        "event_time",
        {
          ascending: true
        }
      );


  if (error) {

    console.error(
      "Booking load error:",
      error
    );

    return;
  }


  bookings =
    (data || [])
      .map(
        row => ({

          id:
            row.id,

          date:
            row.event_date,

          time:
            row.event_time ||
            "",

          endTime:
            row.event_end_time ||
            "",

          type:
            row.event_type,

          customer:
            row.customer_name ||
            "",

          phone:
            row.phone ||
            "",

          bookedBy:
            row.booked_by,

          notes:
            row.notes ||
            "",

          status:
            row.status,

          createdBy:
            row.created_by,

          createdAt:
            row.created_at

        })
      );
}


/* =====================================================
   RENDER ALL
===================================================== */

function renderAll() {

  renderStats();

  renderUpcoming();

  renderCalendar();

  renderBookings();

  renderAvailability();

  renderCustomers();

  renderReports();
}


/* =====================================================
   STATS
===================================================== */

function renderStats() {

  const now =
    new Date();


  const year =
    now.getFullYear();


  const month =
    now.getMonth();


  const active =
    bookings.filter(
      b =>
        b.status !==
        "Cancelled"
    );


  const thisMonth =
    active.filter(
      b => {

        const d =
          new Date(
            b.date +
            "T00:00:00"
          );


        return (
          d.getFullYear() ===
            year &&
          d.getMonth() ===
            month
        );

      }
    );


  const upcoming =
    active.filter(
      b =>
        new Date(
          b.date +
          "T23:59:59"
        ) >= now
    );


  const customers =
    new Set(
      active
        .map(
          b =>
            b.phone ||
            b.customer
        )
        .filter(Boolean)
    );


  if ($("total")) {

    $("total").textContent =
      active.length;

  }


  if ($("month")) {

    $("month").textContent =
      thisMonth.length;

  }


  if ($("upcoming")) {

    $("upcoming").textContent =
      upcoming.length;

  }


  if ($("customers")) {

    $("customers").textContent =
      customers.size;

  }
}


/* =====================================================
   EVENT ICON
===================================================== */

function eventIcon(type) {

  const value =
    String(
      type || ""
    ).toLowerCase();


  if (
    value.includes("birthday")
  ) {

    return "🎂";

  }


  if (
    value.includes("bride")
  ) {

    return "👰";

  }


  if (
    value.includes("proposal")
  ) {

    return "💍";

  }


  if (
    value.includes("anniversary")
  ) {

    return "♥";

  }


  if (
    value.includes("romantic")
  ) {

    return "♥";

  }


  if (
    value.includes("welcome")
  ) {

    return "✦";

  }


  return "✿";
}


/* =====================================================
   UPCOMING
===================================================== */

function renderUpcoming() {

  const container =
    $("upcomingList");


  if (!container) {
    return;
  }


  const today =
    new Date();


  today.setHours(
    0,
    0,
    0,
    0
  );


  const list =
    bookings
      .filter(
        b =>
          b.status !==
          "Cancelled"
      )
      .filter(
        b =>
          new Date(
            b.date +
            "T00:00:00"
          ) >= today
      )
      .sort(
        (a, b) =>
          `${a.date} ${a.time}`
            .localeCompare(
              `${b.date} ${b.time}`
            )
      )
      .slice(0, 5);


  if (!list.length) {

    container.innerHTML =
      `
        <div class="empty">
          No upcoming bookings.
        </div>
      `;

    return;
  }


  container.innerHTML =
    list
      .map(
        b => `

          <div class="booking">

            <div class="thumb">
              ${eventIcon(b.type)}
            </div>

            <div>

              <b>
                ${escapeHTML(
                  b.type
                )}
              </b>

              <div class="sub">
                ${escapeHTML(
                  b.customer ||
                  "Customer not added"
                )}
              </div>

            </div>

            <div class="meta">

              <b>
                ${escapeHTML(
                  formatDate(
                    b.date
                  )
                )}
              </b>

              <br>

              ${escapeHTML(
                formatTimeRange(
                  b.time,
                  b.endTime
                )
              )}

            </div>

            <div class="meta">

              Booked by<br>

              <b>
                ${escapeHTML(
                  b.bookedBy
                )}
              </b>

            </div>

            <div>

              <span class="badge">
                ${escapeHTML(
                  b.status
                )}
              </span>

            </div>

          </div>

        `
      )
      .join("");
}


/* =====================================================
   DASHBOARD CALENDAR
===================================================== */

function renderCalendar() {

  const title =
    $("calTitle");

  const container =
    $("days");


  if (
    !title ||
    !container
  ) {
    return;
  }


  const year =
    calendarDate.getFullYear();


  const month =
    calendarDate.getMonth();


  title.textContent =
    calendarDate.toLocaleDateString(
      "en-IN",
      {
        month:
          "long",

        year:
          "numeric"
      }
    );


  const first =
    new Date(
      year,
      month,
      1
    );


  const last =
    new Date(
      year,
      month + 1,
      0
    );


  container.innerHTML =
    "";


  for (
    let i = 0;
    i < first.getDay();
    i++
  ) {

    container.appendChild(
      document.createElement(
        "span"
      )
    );

  }


  for (
    let day = 1;
    day <= last.getDate();
    day++
  ) {

    const button =
      document.createElement(
        "button"
      );


    const date =
      `${year}-${String(
        month + 1
      ).padStart(
        2,
        "0"
      )}-${String(
        day
      ).padStart(
        2,
        "0"
      )}`;


    button.textContent =
      day;


    const today =
      new Date();


    if (
      today.getFullYear() ===
        year &&
      today.getMonth() ===
        month &&
      today.getDate() ===
        day
    ) {

      button.classList.add(
        "today"
      );

    }


    if (
      bookings.some(
        b =>
          b.date === date &&
          b.status !==
            "Cancelled"
      )
    ) {

      button.classList.add(
        "booked"
      );

    }


    button.addEventListener(
      "click",
      () => {

        openModal(
          date
        );

      }
    );


    container.appendChild(
      button
    );

  }
}


$("prev")
  ?.addEventListener(
    "click",
    () => {

      calendarDate =
        new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth() - 1,
          1
        );

      renderCalendar();

    }
  );


$("next")
  ?.addEventListener(
    "click",
    () => {

      calendarDate =
        new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth() + 1,
          1
        );

      renderCalendar();

    }
  );


/* =====================================================
   BOOKINGS TABLE
===================================================== */

function renderBookings() {

  const container =
    $("allBookings");


  if (!container) {
    return;
  }


  const search =
    (
      $("filter")?.value ||
      $("search")?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  let list =
    [...bookings];


  if (search) {

    list =
      list.filter(
        b => {

          const searchable = [

            b.type,

            b.bookedBy,

            b.customer,

            b.phone,

            b.date,

            b.time,

            b.endTime,

            formatTime(
              b.time
            ),

            formatTime(
              b.endTime
            ),

            b.status

          ]
            .join(" ")
            .toLowerCase();


          return searchable.includes(
            search
          );

        }
      );

  }


  list.sort(
    (a, b) =>
      `${b.date} ${b.time}`
        .localeCompare(
          `${a.date} ${a.time}`
        )
  );


  if (!list.length) {

    container.innerHTML =
      `
        <div class="empty">
          No bookings found.
        </div>
      `;

    return;
  }


  container.innerHTML =
    list
      .map(
        b => `

          <div class="fullrow">

            <div>

              <strong>
                ${escapeHTML(
                  formatDate(
                    b.date
                  )
                )}
              </strong>

            </div>


            <div>

              <strong>
                ${escapeHTML(
                  b.type
                )}
              </strong>

              <div class="sub">

                ${escapeHTML(
                  b.customer ||
                  "No customer"
                )}

              </div>

            </div>


            <div>

              <strong>
                ${escapeHTML(
                  b.bookedBy
                )}
              </strong>

              <div class="sub">

                ${escapeHTML(
                  b.phone ||
                  "No phone"
                )}

              </div>

            </div>


            <div>

              ${escapeHTML(
                formatTimeRange(
                  b.time,
                  b.endTime
                )
              )}

            </div>


            <div>

              <span class="badge">

                ${escapeHTML(
                  b.status
                )}

              </span>

            </div>


            <div class="row-actions">

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

            </div>

          </div>

        `
      )
      .join("");
}


/* =====================================================
   SEARCH
===================================================== */

$("filter")
  ?.addEventListener(
    "input",
    renderBookings
  );


$("search")
  ?.addEventListener(
    "input",
    event => {

      const value =
        event.target.value;


      if ($("filter")) {

        $("filter").value =
          value;

      }


      if (value) {

        showPage(
          "bookings"
        );

      }


      renderBookings();

    }
  );


/* =====================================================
   MODAL
===================================================== */

function setupTimeInputs() {

  const start =
    $("time");

  const end =
    $("endTime");


  if (start) {

    start.type =
      "time";

    /*
      EVERY MINUTE
    */

    start.step =
      "60";

  }


  if (end) {

    end.type =
      "time";

    /*
      EVERY MINUTE
    */

    end.step =
      "60";

  }
}


function openModal(
  selectedDate = ""
) {

  $("modal")
    ?.classList
    .remove("hidden");


  $("bookingForm")
    ?.reset();


  $("editId").value =
    "";


  $("modalTitle").textContent =
    "Create New Booking";


  $("formError").textContent =
    "";


  $("status").value =
    "Confirmed";


  $("type").value =
    "Anniversary Surprise";


  $("bookedBy").value =
    staffProfile?.full_name ||
    "";


  if (selectedDate) {

    $("date").value =
      selectedDate;

  }


  selectedStartTime =
    null;

  selectedEndTime =
    null;


  setupTimeInputs();
}


function closeModal() {

  $("modal")
    ?.classList
    .add("hidden");

}


$("close")
  ?.addEventListener(
    "click",
    closeModal
  );


$("cancelModal")
  ?.addEventListener(
    "click",
    closeModal
  );


$("modal")
  ?.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        $("modal")
      ) {

        closeModal();

      }

    }
  );


/* =====================================================
   SAVE BOOKING
===================================================== */

$("bookingForm")
  ?.addEventListener(
    "submit",
    saveBooking
  );


async function saveBooking(
  event
) {

  event.preventDefault();


  const id =
    $("editId").value;


  const b = {

    type:
      $("type").value,

    date:
      $("date").value,

    time:
      $("time").value,

    endTime:
      $("endTime").value,

    bookedBy:
      $("bookedBy")
        .value
        .trim(),

    customer:
      $("customer")
        .value
        .trim(),

    phone:
      $("phone")
        .value
        .trim(),

    status:
      $("status").value,

    notes:
      $("notes")
        .value
        .trim()

  };


  if (!b.date) {

    $("formError").textContent =
      "Please select a date.";

    return;
  }


  if (!b.time) {

    $("formError").textContent =
      "Please select a start time.";

    return;
  }


  if (!b.endTime) {

    $("formError").textContent =
      "Please select an end time.";

    return;
  }


  const start =
    timeToMinutes(
      b.time
    );


  let end =
    timeToMinutes(
      b.endTime
    );


  /*
    Overnight booking.

    10:30 PM → 1:30 AM
  */

  if (
    end <= start
  ) {

    end +=
      1440;

  }


  if (
    end <= start
  ) {

    $("formError").textContent =
      "Please select a valid end time.";

    return;
  }


  /*
    Minimum 1 hour.
    Every minute is allowed.

    10:01 AM → 11:01 AM = valid
    10:15 AM → 11:15 AM = valid
    10:37 AM → 11:37 AM = valid
  */

  if (
    end - start <
    60
  ) {

    $("formError").textContent =
      "Minimum booking duration is 1 hour.";

    return;
  }


  /*
    Check overlap.
  */

  const duplicate =
    bookings.find(
      x => {

        if (
          x.id === id ||
          x.status ===
            "Cancelled"
        ) {

          return false;

        }


        /*
          Booking on same date.
        */

        if (
          x.date ===
          b.date
        ) {

          const existingEnd =
            x.endTime ||
            minutesToTime(
              timeToMinutes(
                x.time
              ) + 1
            );


          return timeRangesOverlap(
            b.time,
            b.endTime,
            x.time,
            existingEnd
          );

        }


        /*
          Previous date overnight booking.
        */

        const previousDate =
          getPreviousDateString(
            b.date
          );


        if (
          x.date ===
            previousDate &&
          x.time &&
          x.endTime
        ) {

          const xStart =
            timeToMinutes(
              x.time
            );

          const xEnd =
            timeToMinutes(
              x.endTime
            );


          if (
            xEnd <= xStart
          ) {

            return (
              start < xEnd
            );

          }

        }


        return false;

      }
    );


  if (duplicate) {

    $("formError").textContent =
      `This time overlaps with ${
        duplicate.bookedBy
      }'s booking (${
        formatTimeRange(
          duplicate.time,
          duplicate.endTime
        )
      }).`;

    return;
  }


  $("formError").textContent =
    "Saving booking…";


  const row = {

    event_date:
      b.date,

    event_time:
      b.time,

    event_end_time:
      b.endTime,

    event_type:
      b.type,

    booked_by:
      b.bookedBy,

    customer_name:
      b.customer ||
      null,

    phone:
      b.phone ||
      null,

    status:
      b.status,

    notes:
      b.notes ||
      null

  };


  let result;


  if (id) {

    result =
      await db
        .from("bookings")
        .update(row)
        .eq(
          "id",
          id
        )
        .select()
        .single();

  }

  else {

    result =
      await db
        .from("bookings")
        .insert({

          ...row,

          created_by:
            currentUser.id

        })
        .select()
        .single();

  }


  if (result.error) {

    $("formError").textContent =
      result.error.message;

    return;
  }


  closeModal();


  await loadBookings();


  renderAll();
}


/* =====================================================
   EDIT BOOKING
===================================================== */

window.editBooking =
  function(id) {

    const b =
      bookings.find(
        x =>
          x.id === id
      );


    if (!b) {
      return;
    }


    $("modal")
      ?.classList
      .remove("hidden");


    $("modalTitle").textContent =
      "Edit Booking";


    $("editId").value =
      b.id;


    $("type").value =
      b.type;


    $("status").value =
      b.status;


    $("date").value =
      b.date;


    $("bookedBy").value =
      b.bookedBy;


    $("customer").value =
      b.customer;


    $("phone").value =
      b.phone;


    $("notes").value =
      b.notes;


    setupTimeInputs();


    $("time").value =
      b.time;


    $("endTime").value =
      b.endTime ||
      minutesToTime(
        timeToMinutes(
          b.time
        ) + 60
      );


    $("formError").textContent =
      "";

  };


/* =====================================================
   DELETE BOOKING
===================================================== */

window.deleteBooking =
  async function(id) {

    const booking =
      bookings.find(
        x =>
          x.id === id
      );


    if (!booking) {
      return;
    }


    const ok =
      confirm(
        `Delete booking for ${
          booking.customer ||
          "this customer"
        }?`
      );


    if (!ok) {
      return;
    }


    const {
      error
    } =
      await db
        .from("bookings")
        .delete()
        .eq(
          "id",
          id
        );


    if (error) {

      alert(
        error.message
      );

      return;
    }


    await loadBookings();

    renderAll();

  };


/* =====================================================
   AVAILABILITY
===================================================== */

function renderAvailability() {

  if (
    !selectedAvailabilityDate
  ) {

    selectedAvailabilityDate =
      getLocalDateString();

  }


  /*
    KEEP THE DATE STRIP.
    SHOW 1 YEAR.
  */

  renderAvailabilityDates();


  /*
    KEEP THE CLOCK UI.
    NO 30-MINUTE GRID.
  */

  renderAvailabilityClock();
}


/* =====================================================
   1 YEAR DATE STRIP
===================================================== */

function renderAvailabilityDates() {

  const container =
    $("availDays");


  if (!container) {
    return;
  }


  container.innerHTML =
    "";


  const base =
    new Date();


  /*
    365 DAYS
  */

  for (
    let i = 0;
    i < 365;
    i++
  ) {

    const date =
      new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate() + i
      );


    const dateString =
      [
        date.getFullYear(),

        String(
          date.getMonth() + 1
        ).padStart(
          2,
          "0"
        ),

        String(
          date.getDate()
        ).padStart(
          2,
          "0"
        )

      ].join("-");


    const button =
      document.createElement(
        "button"
      );


    button.type =
      "button";


    button.className =
      "availability-date";


    if (
      dateString ===
      selectedAvailabilityDate
    ) {

      button.classList.add(
        "selected"
      );

    }


    button.innerHTML = `

      <span class="day-name">

        ${date.toLocaleDateString(
          "en-IN",
          {
            weekday:
              "short"
          }
        ).toUpperCase()}

      </span>


      <span class="day-number">

        ${date.getDate()}

      </span>


      <span class="month-name">

        ${date.toLocaleDateString(
          "en-IN",
          {
            month:
              "short"
          }
        )}

      </span>

    `;


    button.addEventListener(
      "click",
      () => {

        selectedAvailabilityDate =
          dateString;

        selectedStartTime =
          null;

        selectedEndTime =
          null;

        renderAvailability();

      }
    );


    container.appendChild(
      button
    );

  }
}


/* =====================================================
   CHECK A BOOKING AT A SPECIFIC MINUTE
===================================================== */

function isMinuteBooked(
  date,
  minute
) {

  return bookings.some(
    b => {

      if (
        b.status ===
          "Cancelled" ||
        !b.time
      ) {

        return false;

      }


      const bookingStart =
        timeToMinutes(
          b.time
        );


      let bookingEnd =
        b.endTime
          ? timeToMinutes(
              b.endTime
            )
          : bookingStart + 1;


      /*
        Booking begins on this date.
      */

      if (
        b.date === date
      ) {

        /*
          Overnight:
          10 PM → 1 AM
        */

        if (
          bookingEnd <=
          bookingStart
        ) {

          return (
            minute >=
              bookingStart ||
            minute <
              bookingEnd
          );

        }


        return (
          minute >=
            bookingStart &&
          minute <
            bookingEnd
        );

      }


      /*
        Overnight booking from
        previous date.
      */

      const previousDate =
        getPreviousDateString(
          date
        );


      if (
        b.date ===
          previousDate &&
        bookingEnd <=
          bookingStart
      ) {

        return (
          minute <
          bookingEnd
        );

      }


      return false;

    }
  );
}


/* =====================================================
   CHECK ENTIRE RANGE
===================================================== */

function checkRangeAvailability(
  date,
  startTime,
  endTime
) {

  if (
    !startTime ||
    !endTime
  ) {

    return {
      available: false,
      message:
        "Please select both start and end time."
    };

  }


  const start =
    timeToMinutes(
      startTime
    );


  let end =
    timeToMinutes(
      endTime
    );


  /*
    Overnight booking.
  */

  if (
    end <= start
  ) {

    end +=
      1440;

  }


  if (
    end <= start
  ) {

    return {
      available: false,
      message:
        "Please select a valid end time."
    };

  }


  /*
    Minimum one hour.
  */

  if (
    end - start <
    60
  ) {

    return {
      available: false,
      message:
        "Minimum booking duration is 1 hour."
    };

  }


  /*
    Check EVERY MINUTE.
  */

  for (
    let minute = start;
    minute < end;
    minute++
  ) {

    let checkDate =
      date;


    let checkMinute =
      minute;


    /*
      Crossed midnight.
    */

    if (
      checkMinute >=
      1440
    ) {

      checkMinute -=
        1440;


      checkDate =
        getNextDateString(
          date
        );

    }


    if (
      isMinuteBooked(
        checkDate,
        checkMinute
      )
    ) {

      return {

        available:
          false,

        message:
          "This time range contains an existing booking."

      };

    }

  }


  return {
    available:
      true,

    message:
      "Available"
  };
}


/* =====================================================
   AVAILABILITY CLOCK
===================================================== */

function renderAvailabilityClock() {

  const container =
    $("availInfo");


  if (!container) {
    return;
  }


  const date =
    selectedAvailabilityDate;


  if (!date) {
    return;
  }


  /*
    Existing bookings for this date.
  */

  const dayBookings =
    bookings
      .filter(
        b =>
          b.date === date &&
          b.status !==
            "Cancelled"
      )
      .sort(
        (a, b) =>
          timeToMinutes(
            a.time
          ) -
          timeToMinutes(
            b.time
          )
      );


  let html = `

    <h2 class="availability-title">

      ${formatDate(date)}

    </h2>


    <p class="availability-help">

      Select the start and end time using the clock.
      Every minute is available.

    </p>


    <div
      class="availability-clock-panel"
    >

      <div class="clock-field">

        <label>
          Start Time
        </label>

        <input
          id="availabilityStart"
          type="time"
          step="60"
          value="${
            selectedStartTime || ""
          }"
        >

      </div>


      <div class="clock-arrow">
        →
      </div>


      <div class="clock-field">

        <label>
          End Time
        </label>

        <input
          id="availabilityEnd"
          type="time"
          step="60"
          value="${
            selectedEndTime || ""
          }"
        >

      </div>

    </div>


    <div
      id="availabilityStatus"
      class="availability-status"
    ></div>


    <div
      class="availability-actions"
    >

      <button
        type="button"
        class="create"
        id="checkAvailabilityBtn"
      >
        Check Availability
      </button>


      <button
        type="button"
        class="create"
        id="bookAvailabilityBtn"
        style="display:none;"
      >
        Book This Time →
      </button>

    </div>

  `;


  /*
    Existing bookings.
  */

  if (
    dayBookings.length
  ) {

    html += `

      <div
        class="availability-booked-list"
      >

        <h3>
          Bookings on this date
        </h3>

    `;


    dayBookings.forEach(
      b => {

        html += `

          <div
            class="availability-booked-item"
          >

            <div>

              <strong>

                ${escapeHTML(
                  b.type
                )}

              </strong>

              <div class="sub">

                ${escapeHTML(
                  b.customer ||
                  "No customer"
                )}

              </div>

            </div>


            <div
              class="availability-booked-time"
            >

              ${escapeHTML(
                formatTimeRange(
                  b.time,
                  b.endTime
                )
              )}

            </div>

          </div>

        `;

      }
    );


    html += `
      </div>
    `;

  }

  else {

    html += `

      <div
        class="availability-free"
      >

        No bookings on this date.

      </div>

    `;

  }


  container.innerHTML =
    html;


  const startInput =
    $("availabilityStart");


  const endInput =
    $("availabilityEnd");


  const checkButton =
    $("checkAvailabilityBtn");


  const bookButton =
    $("bookAvailabilityBtn");


  const status =
    $("availabilityStatus");


  /*
    Check availability.
  */

  checkButton?.addEventListener(
    "click",
    () => {

      const start =
        startInput.value;


      const end =
        endInput.value;


      const result =
        checkRangeAvailability(
          date,
          start,
          end
        );


      if (
        !result.available
      ) {

        status.innerHTML = `

          <strong>
            Not Available
          </strong>

          <br>

          ${escapeHTML(
            result.message
          )}

        `;


        status.className =
          "availability-status unavailable";


        bookButton.style.display =
          "none";


        return;
      }


      /*
        Save selected values.
      */

      selectedStartTime =
        start;


      selectedEndTime =
        end;


      status.innerHTML = `

        <strong>
          Available ✓
        </strong>

        <br>

        ${escapeHTML(
          formatTimeRange(
            start,
            end
          )
        )}

      `;


      status.className =
        "availability-status available";


      bookButton.style.display =
        "inline-flex";

    }
  );


  /*
    Book selected availability.
  */

  bookButton?.addEventListener(
    "click",
    () => {

      const start =
        startInput.value;


      const end =
        endInput.value;


      if (
        !start ||
        !end
      ) {

        return;

      }


      selectedStartTime =
        start;


      selectedEndTime =
        end;


      openModal(
        selectedAvailabilityDate
      );


      setupTimeInputs();


      $("time").value =
        start;


      $("endTime").value =
        end;

    }
  );


  /*
    Keep values synchronized
    when the user changes the
    native clock picker.
  */

  startInput?.addEventListener(
    "change",
    () => {

      selectedStartTime =
        startInput.value;

      selectedEndTime =
        null;

      if (status) {

        status.textContent =
          "";

        status.className =
          "availability-status";

      }

      if (bookButton) {

        bookButton.style.display =
          "none";

      }

    }
  );


  endInput?.addEventListener(
    "change",
    () => {

      selectedEndTime =
        endInput.value;

      if (status) {

        status.textContent =
          "";

        status.className =
          "availability-status";

      }

      if (bookButton) {

        bookButton.style.display =
          "none";

      }

    }
  );
}


/* =====================================================
   CUSTOMERS
===================================================== */

function renderCustomers() {

  const container =
    $("customerGrid");


  if (!container) {
    return;
  }


  const map =
    new Map();


  bookings.forEach(
    b => {

      const key =
        b.phone ||
        b.customer ||
        "Unknown";


      if (!map.has(key)) {

        map.set(
          key,
          {

            name:
              b.customer ||
              "Unknown Customer",

            phone:
              b.phone ||
              "",

            bookings:
              0

          }
        );

      }


      map.get(
        key
      ).bookings++;

    }
  );


  const list =
    [...map.values()];


  if (!list.length) {

    container.innerHTML =
      `
        <div class="empty">
          No customers yet.
        </div>
      `;

    return;
  }


  container.innerHTML =
    list
      .map(
        customer => {

          const initials =
            customer.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map(
                x => x[0]
              )
              .join("")
              .toUpperCase();


          return `

            <div
              class="customer-card"
            >

              <div
                class="customer-avatar"
              >

                ${escapeHTML(
                  initials ||
                  "C"
                )}

              </div>


              <h3>

                ${escapeHTML(
                  customer.name
                )}

              </h3>


              <p>

                ${escapeHTML(
                  customer.phone ||
                  "No phone number"
                )}

              </p>


              <p>

                ${customer.bookings}

                booking${
                  customer.bookings === 1
                    ? ""
                    : "s"
                }

              </p>

            </div>

          `;

        }
      )
      .join("");
}


/* =====================================================
   REPORTS
===================================================== */

function renderReports() {

  const container =
    $("reportsGrid");


  if (!container) {
    return;
  }


  const active =
    bookings.filter(
      b =>
        b.status !==
        "Cancelled"
    );


  const confirmed =
    bookings.filter(
      b =>
        b.status ===
        "Confirmed"
    );


  const completed =
    bookings.filter(
      b =>
        b.status ===
        "Completed"
    );


  const cancelled =
    bookings.filter(
      b =>
        b.status ===
        "Cancelled"
    );


  const customers =
    new Set(
      active
        .map(
          b =>
            b.phone ||
            b.customer
        )
        .filter(Boolean)
    );


  const birthday =
    active.filter(
      b =>
        b.type ===
        "Birthday Surprise"
    );


  container.innerHTML = `

    <div class="report-card">

      <strong>
        ${active.length}
      </strong>

      <span>
        Active Bookings
      </span>

    </div>


    <div class="report-card">

      <strong>
        ${confirmed.length}
      </strong>

      <span>
        Confirmed
      </span>

    </div>


    <div class="report-card">

      <strong>
        ${completed.length}
      </strong>

      <span>
        Completed
      </span>

    </div>


    <div class="report-card">

      <strong>
        ${cancelled.length}
      </strong>

      <span>
        Cancelled
      </span>

    </div>


    <div class="report-card">

      <strong>
        ${customers.size}
      </strong>

      <span>
        Unique Customers
      </span>

    </div>


    <div class="report-card">

      <strong>
        ${birthday.length}
      </strong>

      <span>
        Birthday Surprises
      </span>

    </div>

  `;
}


/* =====================================================
   NAVIGATION
===================================================== */

function showPage(
  page
) {

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(
      section => {

        section.classList.add(
          "hidden"
        );

      }
    );


  const target =
    $(page);


  if (target) {

    target.classList.remove(
      "hidden"
    );

  }


  document
    .querySelectorAll(
      "nav button[data-page]"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
            page
        );

      }
    );


  if (
    window.innerWidth <=
    900
  ) {

    document
      .querySelector(
        "aside"
      )
      ?.classList
      .remove(
        "open"
      );

  }


  if (
    page ===
    "availability"
  ) {

    renderAvailability();

  }
}


document
  .querySelectorAll(
    "[data-page]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.page
          );

        }
      );

    }
  );


document
  .querySelectorAll(
    "[data-add='booking']"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          openModal();

        }
      );

    }
  );


/* =====================================================
   MOBILE MENU
===================================================== */

$("menu")
  ?.addEventListener(
    "click",
    () => {

      document
        .querySelector(
          "aside"
        )
        ?.classList
        .toggle(
          "open"
        );

    }
  );


/* =====================================================
   START
===================================================== */

initializeAuth();
