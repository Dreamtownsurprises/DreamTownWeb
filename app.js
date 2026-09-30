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
   HELPERS
===================================================== */

const $ = id =>
  document.getElementById(id);


function escapeHTML(value) {

  if (value === null || value === undefined) {
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
    Number(parts[1])
  );
}


function minutesToTime(minutes) {

  minutes = minutes % (24 * 60);

  if (minutes < 0) {
    minutes += 24 * 60;
  }

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return (
    String(h).padStart(2,"0") +
    ":" +
    String(m).padStart(2,"0")
  );
}


function formatTime(time) {

  if (!time) {
    return "TBD";
  }

  const parts =
    time.split(":");

  const hour =
    Number(parts[0]);

  const minute =
    parts[1];

  const suffix =
    hour >= 12
      ? "PM"
      : "AM";

  const displayHour =
    hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}


function formatTimeRange(start,end) {

  if (!start) {
    return "TBD";
  }

  if (!end) {
    return formatTime(start);
  }

  return `${formatTime(start)} – ${formatTime(end)}`;
}


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

  let aStart = timeToMinutes(startA);
  let aEnd = timeToMinutes(endA);
  let bStart = timeToMinutes(startB);
  let bEnd = timeToMinutes(endB);

  // Support overnight bookings such as 10:00 PM → 1:00 AM.
  if (aEnd <= aStart) aEnd += 24 * 60;
  if (bEnd <= bStart) bEnd += 24 * 60;

  return (
    aStart < bEnd &&
    aEnd > bStart
  );
}


/* =====================================================
   TIMEZONE GREETING
===================================================== */

function updateGreeting() {

  const greeting =
    $("greeting");

  if (!greeting) {
    return;
  }

  /*
    Uses the browser/device local timezone.
    India = Asia/Kolkata automatically.
  */

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
    .classList
    .remove("hidden");

  $("app")
    .classList
    .add("hidden");
}


function showApp() {

  $("login")
    .classList
    .add("hidden");

  $("app")
    .classList
    .remove("hidden");
}


function showLoginPanel() {

  $("loginPanel")
    .classList
    .remove("hidden");

  $("signupPanel")
    .classList
    .add("hidden");
}


function showSignupPanel() {

  $("loginPanel")
    .classList
    .add("hidden");

  $("signupPanel")
    .classList
    .remove("hidden");
}


/* =====================================================
   INITIAL AUTH
===================================================== */

async function initializeAuth() {

  /*
    Force fresh login on page load.
    Remove these two lines if you later want
    persistent login sessions.
  */

  await db.auth.signOut();

  showLogin();


  db.auth.onAuthStateChange(
    async (event,session) => {

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


async function handleSignedIn(user) {

  currentUser =
    user;


  const { data,error } =
    await db
      .from("staff")
      .select("user_id,full_name")
      .eq("user_id",user.id)
      .maybeSingle();


  if (error) {

    console.error(error);

    await db.auth.signOut();

    $("loginError").textContent =
      "Unable to verify your account.";

    return;
  }


  if (!data) {

    await db.auth.signOut();

    $("loginError").textContent =
      "Your account is not approved for this dashboard.";

    return;
  }


  staffProfile =
    data;


  showApp();


  const name =
    data.full_name ||
    user.email?.split("@")[0] ||
    "Admin";


  $("profileName").textContent =
    name;

  $("welcomeName").textContent =
    name;


  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0,2)
      .map(x => x[0])
      .join("")
      .toUpperCase();


  $("profileInitials").textContent =
    initials || "DT";


  await loadBookings();

  renderAll();

  updateGreeting();
}


/* =====================================================
   LOGIN
===================================================== */

$("loginForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      $("loginError")
        .textContent =
        "Signing in…";


      const email =
        $("user")
          .value
          .trim();

      const password =
        $("pass")
          .value;


      const { data,error } =
        await db.auth.signInWithPassword({

          email,
          password

        });


      if (error) {

        $("loginError")
          .textContent =
          error.message;

        return;
      }


      await handleSignedIn(
        data.user
      );

    }
  );


$("logout")
  .addEventListener(
    "click",
    async () => {

      await db.auth.signOut();

    }
  );


$("showSignup")
  .addEventListener(
    "click",
    showSignupPanel
  );


$("showLogin")
  .addEventListener(
    "click",
    showLoginPanel
  );


/* =====================================================
   FORGOT PASSWORD
===================================================== */

$("forgot")
  .addEventListener(
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


      const { error } =
        await db.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: redirect
          }
        );


      $("loginError").textContent =
        error
          ? error.message
          : "Password reset email sent.";

    }
  );


/* =====================================================
   SIGNUP
===================================================== */

$("signupForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      $("signupError")
        .textContent =
        "Creating account…";


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


      if (password.length < 8) {

        $("signupError")
          .textContent =
          "Password must contain at least 8 characters.";

        return;
      }


      const { data,error } =
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

        $("signupError")
          .textContent =
          error.message;

        return;
      }


      if (data.user) {

        $("signupError")
          .textContent =
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


  const { data,error } =
    await db
      .from("bookings")
      .select("*")
      .order("event_date",{ ascending:true })
      .order("event_time",{ ascending:true });


  if (error) {

    console.error(
      "Booking load error:",
      error
    );

    return;
  }


  bookings =
    (data || []).map(row => ({

      id:
        row.id,

      date:
        row.event_date,

      time:
        row.event_time || "",

      endTime:
        row.event_end_time || "",

      type:
        row.event_type,

      customer:
        row.customer_name || "",

      phone:
        row.phone || "",

      bookedBy:
        row.booked_by,

      notes:
        row.notes || "",

      status:
        row.status,

      createdBy:
        row.created_by,

      createdAt:
        row.created_at

    }));

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
        b.status !== "Cancelled"
    );


  const thisMonth =
    active.filter(b => {

      const d =
        new Date(
          b.date + "T00:00:00"
        );

      return (
        d.getFullYear() === year &&
        d.getMonth() === month
      );

    });


  const upcoming =
    active.filter(b => {

      return (
        new Date(
          b.date + "T23:59:59"
        ) >= now
      );

    });


  const customerSet =
    new Set(
      active
        .map(b => b.phone || b.customer)
        .filter(Boolean)
    );


  $("total").textContent =
    active.length;

  $("month").textContent =
    thisMonth.length;

  $("upcoming").textContent =
    upcoming.length;

  $("customers").textContent =
    customerSet.size;

}


/* =====================================================
   EVENT ICON
===================================================== */

function eventIcon(type) {

  if (
    type
      .toLowerCase()
      .includes("birthday")
  ) {
    return "🎂";
  }

  if (
    type
      .toLowerCase()
      .includes("bride")
  ) {
    return "👰";
  }

  if (
    type
      .toLowerCase()
      .includes("proposal")
  ) {
    return "💍";
  }

  if (
    type
      .toLowerCase()
      .includes("anniversary")
  ) {
    return "♥";
  }

  if (
    type
      .toLowerCase()
      .includes("romantic")
  ) {
    return "♥";
  }

  if (
    type
      .toLowerCase()
      .includes("welcome")
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


  const today =
    new Date();

  today.setHours(
    0,0,0,0
  );


  const list =
    bookings

      .filter(b =>
        b.status !== "Cancelled"
      )

      .filter(b => {

        const d =
          new Date(
            b.date + "T00:00:00"
          );

        return d >= today;

      })

      .sort((a,b) => {

        const aa =
          `${a.date} ${a.time}`;

        const bb =
          `${b.date} ${b.time}`;

        return aa.localeCompare(bb);

      })

      .slice(0,5);


  if (!list.length) {

    container.innerHTML =
      `<div class="empty">
        No upcoming bookings.
      </div>`;

    return;
  }


  container.innerHTML =
    list.map(b => {

      return `

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
                b.customer || "Customer not added"
              )}
            </div>

          </div>

          <div class="meta">

            <b>
              ${escapeHTML(
                formatDate(b.date)
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

      `;

    }).join("");

}


/* =====================================================
   DATE FORMAT
===================================================== */

function formatDate(dateString) {

  if (!dateString) {
    return "";
  }

  const d =
    new Date(
      dateString + "T00:00:00"
    );


  return d.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}


/* =====================================================
   CALENDAR
===================================================== */

function renderCalendar() {

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();


  $("calTitle").textContent =
    calendarDate.toLocaleDateString(
      "en-IN",
      {
        month: "long",
        year: "numeric"
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


  const container =
    $("days");


  container.innerHTML = "";


  for (
    let i = 0;
    i < first.getDay();
    i++
  ) {

    const blank =
      document.createElement("span");

    container.appendChild(blank);

  }


  for (
    let day = 1;
    day <= last.getDate();
    day++
  ) {

    const button =
      document.createElement("button");


    const date =
      `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;


    button.textContent =
      day;


    const today =
      new Date();


    if (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    ) {

      button.classList.add("today");

    }


    if (
      bookings.some(
        b =>
          b.date === date &&
          b.status !== "Cancelled"
      )
    ) {

      button.classList.add("booked");

    }


    button.addEventListener(
      "click",
      () => {

        openModal(
          date
        );

      }
    );


    container.appendChild(button);

  }

}


$("prev")
  .addEventListener(
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
  .addEventListener(
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
      list.filter(b => {

        const searchable = [

          b.type,
          b.bookedBy,
          b.customer,
          b.phone,
          b.date,
          b.time,
          b.endTime,
          formatTime(b.time),
          formatTime(b.endTime),
          b.status

        ]
          .join(" ")
          .toLowerCase();


        return searchable.includes(
          search
        );

      });

  }


  list.sort((a,b) => {

    const aa =
      `${a.date} ${a.time}`;

    const bb =
      `${b.date} ${b.time}`;

    return bb.localeCompare(aa);

  });


  if (!list.length) {

    container.innerHTML =
      `<div class="empty">
        No bookings found.
      </div>`;

    return;
  }


  container.innerHTML =
    list.map(b => {

      return `

        <div class="fullrow">

          <div>

            <strong>
              ${escapeHTML(
                formatDate(b.date)
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

      `;

    }).join("");

}


/* =====================================================
   SEARCH
===================================================== */

$("filter")
  .addEventListener(
    "input",
    renderBookings
  );


$("search")
  .addEventListener(
    "input",
    event => {

      const value =
        event.target.value;


      $("filter").value =
        value;


      if (value) {
        showPage("bookings");
      }

      renderBookings();

    }
  );


/* =====================================================
   MODAL
===================================================== */

function openModal(
  selectedDate = ""
) {

  $("modal")
    .classList
    .remove("hidden");

  $("bookingForm")
    .reset();

  $("editId").value = "";

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
    $("date").value = selectedDate;
  }

  $("time").value = "";
  $("endTime").value = "";

  selectedStartTime = null;
  selectedEndTime = null;

  renderBookingTimePicker();

}


function closeModal() {

  $("modal")
    .classList
    .add("hidden");

}


$("close")
  .addEventListener(
    "click",
    closeModal
  );


$("cancelModal")
  .addEventListener(
    "click",
    closeModal
  );


$("modal")
  .addEventListener(
    "click",
    event => {

      if (
        event.target === $("modal")
      ) {

        closeModal();

      }

    }
  );


/* =====================================================
   SAVE BOOKING
===================================================== */

$("bookingForm")
  .addEventListener(
    "submit",
    saveBooking
  );


async function saveBooking(event) {

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

  const end =
    timeToMinutes(
      b.endTime
    );


  let normalizedEnd = end;

  // Allow overnight bookings such as 10:00 PM → 1:00 AM.
  if (normalizedEnd <= start) {
    normalizedEnd += 24 * 60;
  }

  if (normalizedEnd <= start) {

    $("formError").textContent =
      "Please select a valid end time.";

    return;
  }


  if (
    normalizedEnd - start < 60
  ) {

    $("formError").textContent =
      "Minimum booking duration is 1 hour.";

    return;
  }


  /*
    Check overlap.
  */

  const duplicate =
    bookings.find(x => {

      if (
        x.id === id ||
        x.date !== b.date ||
        x.status === "Cancelled"
      ) {

        return false;

      }


      const existingStart =
        x.time;


      const existingEnd =
        x.endTime ||
        minutesToTime(
          timeToMinutes(
            x.time
          ) + 30
        );


      return timeRangesOverlap(
        b.time,
        b.endTime,
        existingStart,
        existingEnd
      );

    });


  if (duplicate) {

    $("formError").textContent =
      `This time overlaps with ${duplicate.bookedBy}'s booking (${formatTimeRange(
        duplicate.time,
        duplicate.endTime ||
        minutesToTime(
          timeToMinutes(
            duplicate.time
          ) + 30
        )
      )}).`;

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
        .from("bookings")
        .update(row)
        .eq("id",id)
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
   EDIT
===================================================== */

window.editBooking =
  function(id) {

    const b =
      bookings.find(
        x => x.id === id
      );

    if (!b) {
      return;
    }

    $("modal")
      .classList
      .remove("hidden");

    $("modalTitle").textContent =
      "Edit Booking";

    $("editId").value = b.id;
    $("type").value = b.type;
    $("status").value = b.status;
    $("date").value = b.date;
    $("time").value = b.time;
    $("endTime").value = b.endTime || "";
    $("bookedBy").value = b.bookedBy;
    $("customer").value = b.customer;
    $("phone").value = b.phone;
    $("notes").value = b.notes;
    $("formError").textContent = "";

    renderBookingTimePicker();

  };


/* =====================================================
   DELETE
===================================================== */

window.deleteBooking =
  async function(id) {

    const booking =
      bookings.find(
        x => x.id === id
      );


    if (!booking) {
      return;
    }


    const ok =
      confirm(
        `Delete booking for ${booking.customer || "this customer"}?`
      );


    if (!ok) {
      return;
    }


    const { error } =
      await db
        .from("bookings")
        .delete()
        .eq("id",id);


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
   365 DAYS + 30-MINUTE TIME GRID
===================================================== */

function renderAvailability() {

  if (!selectedAvailabilityDate) {
    selectedAvailabilityDate = getLocalDateString();
  }

  renderAvailabilityDates();
  renderAvailabilitySlots();

}


function getLocalDateString() {

  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2,"0"),
    String(now.getDate()).padStart(2,"0")
  ].join("-");

}


/* =====================================================
   AVAILABILITY DATE STRIP
   NEXT 365 DAYS
===================================================== */

function renderAvailabilityDates() {

  const container = $("availDays");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const base = new Date();

  for (let i = 0; i < 365; i++) {

    const date = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + i
    );

    const dateString = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2,"0"),
      String(date.getDate()).padStart(2,"0")
    ].join("-");

    const button = document.createElement("button");

    button.type = "button";
    button.className = "availability-date";

    if (dateString === selectedAvailabilityDate) {
      button.classList.add("selected");
    }

    button.innerHTML = `
      <span class="day-name">
        ${date.toLocaleDateString("en-IN", { weekday:"short" })}
      </span>

      <span class="day-number">
        ${date.getDate()}
      </span>

      <span class="month-name">
        ${date.toLocaleDateString("en-IN", { month:"short" })}
      </span>
    `;

    button.addEventListener("click", () => {

      selectedAvailabilityDate = dateString;
      selectedStartTime = null;
      selectedEndTime = null;

      renderAvailability();

    });

    container.appendChild(button);
  }

}


/* =====================================================
   CHECK BOOKED TIME
===================================================== */

function getPreviousDateString(dateString) {

  const d = new Date(dateString + "T00:00:00");

  d.setDate(d.getDate() - 1);

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2,"0"),
    String(d.getDate()).padStart(2,"0")
  ].join("-");

}


function isTimeBooked(date, time) {

  const target = timeToMinutes(time);
  const previousDate = getPreviousDateString(date);

  return bookings.some(b => {

    if (b.status === "Cancelled" || !b.time) {
      return false;
    }

    const start = timeToMinutes(b.time);
    const end = b.endTime
      ? timeToMinutes(b.endTime)
      : start + 30;

    /* Same-day booking */
    if (b.date === date) {

      if (end <= start) {
        return target >= start;
      }

      return target >= start && target < end;
    }

    /* Early morning portion of an overnight booking */
    if (b.date === previousDate && end <= start) {
      return target < end;
    }

    return false;

  });

}


/* =====================================================
   AVAILABILITY TIME GRID
===================================================== */

function renderAvailabilitySlots() {

  const container = $("availInfo");

  if (!container || !selectedAvailabilityDate) {
    return;
  }

  const date = selectedAvailabilityDate;

  let html = `
    <div class="availability-header">

      <div>
        <span class="section-label">
          SELECT TIME
        </span>

        <h2>
          ${formatDate(date)}
        </h2>
      </div>

      <p class="availability-instruction">
        Tap a time to start, then tap another to set how long you need.
        Stay 3–4 hours if your event needs it.
      </p>

    </div>

    <div class="availability-time-grid">
  `;

  /* 10:00 AM to 1:00 AM next day, every 30 minutes */
  for (let minutes = 10 * 60; minutes <= 25 * 60; minutes += 30) {

    const time = minutesToTime(minutes);
    const booked = isTimeBooked(date, time);
    const isStart = selectedStartTime === time;
    const isEnd = selectedEndTime === time;

    let disabled = booked;

    /* Once a start is selected, only later times can be an end time. */
    if (selectedStartTime && !selectedEndTime) {

      const startMinutes = timeToMinutes(selectedStartTime);
      let currentMinutes = timeToMinutes(time);

      /*
        Times after midnight (12:00 AM → 1:00 AM)
        belong to the next day when the start is in
        the evening.
      */
      if (currentMinutes <= startMinutes) {
        currentMinutes += 24 * 60;
      }

      if (currentMinutes < startMinutes + 60) {
        disabled = true;
      }

    }

    let classes = "availability-time";

    if (booked) {
      classes += " booked";
    }

    if (isStart) {
      classes += " start-selected";
    }

    if (isEnd) {
      classes += " end-selected";
    }

    html += `
      <button
        type="button"
        class="${classes}"
        ${disabled ? "disabled" : ""}
        onclick="selectAvailabilityTime('${time}')"
      >
        ${formatTime(time)}
      </button>
    `;

  }

  html += `</div>`;

  if (selectedStartTime) {

    html += `
      <div class="availability-selection">

        <div class="availability-selected-times">

          <div>
            <span>START TIME</span>
            <strong>${formatTime(selectedStartTime)}</strong>
          </div>

          <div class="selection-arrow">→</div>

          <div>
            <span>END TIME</span>
            <strong>
              ${selectedEndTime ? formatTime(selectedEndTime) : "Select end"}
            </strong>
          </div>

        </div>

        ${selectedEndTime ? `
          <button
            type="button"
            class="create"
            onclick="bookSelectedAvailability()"
          >
            Continue Booking →
          </button>
        ` : `
          <div class="availability-next">
            Now select the end time.
          </div>
        `}

      </div>
    `;
  }

  container.innerHTML = html;

}


/* =====================================================
   AVAILABILITY TIME SELECTION
===================================================== */

window.selectAvailabilityTime = function(time) {

  /* First click = start */
  if (!selectedStartTime || selectedEndTime) {

    selectedStartTime = time;
    selectedEndTime = null;

    renderAvailability();
    return;
  }

  const start = timeToMinutes(selectedStartTime);
  let end = timeToMinutes(time);

  /*
    Support overnight selection.
    Example: 10:00 PM → 1:00 AM.
  */
  if (end <= start) {
    end += 24 * 60;
  }

  if (end - start < 60) {
    alert("Minimum booking duration is 1 hour.");
    return;
  }

  /* Check every 30-minute block in the requested range. */
  for (let t = start; t < end; t += 30) {

    if (isTimeBooked(selectedAvailabilityDate, minutesToTime(t))) {

      alert("This time range contains an already booked time.");

      selectedEndTime = null;
      renderAvailability();
      return;
    }

  }

  selectedEndTime = time;

  renderAvailability();

};


window.bookSelectedAvailability = function() {

  if (!selectedStartTime || !selectedEndTime) {
    return;
  }

  openModal(selectedAvailabilityDate);

  $("time").value = selectedStartTime;
  $("endTime").value = selectedEndTime;

  renderBookingTimePicker();

};


/* =====================================================
   BOOKING MODAL TIME PICKER
===================================================== */

function renderBookingTimePicker() {

  const startContainer = $("bookingStartTimes");
  const endContainer = $("bookingEndTimes");

  if (!startContainer || !endContainer) {
    return;
  }

  const currentStart = $("time").value;
  const currentEnd = $("endTime").value;

  let startHTML = "";
  let endHTML = "";

  /* Start times: 10:00 AM → 1:00 AM next day */
  for (let minutes = 10 * 60; minutes <= 25 * 60; minutes += 30) {

    const time = minutesToTime(minutes);
    const selected = currentStart === time;

    startHTML += `
      <button
        type="button"
        class="booking-time-button ${selected ? "selected" : ""}"
        onclick="selectBookingStartTime('${time}')"
      >
        ${formatTime(time)}
      </button>
    `;
  }

  /* End times: 10:00 AM → 1:00 AM next day */
  for (let minutes = 10 * 60; minutes <= 25 * 60; minutes += 30) {

    const time = minutesToTime(minutes);
    let disabled = false;

    if (currentStart) {

      const startMinutes = timeToMinutes(currentStart);
      let endMinutes = timeToMinutes(time);

      /* Allow an end time after midnight. */
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
      }

      if (endMinutes - startMinutes < 60) {
        disabled = true;
      }

    }

    const selected = currentEnd === time;

    endHTML += `
      <button
        type="button"
        class="booking-time-button ${selected ? "selected" : ""}"
        ${disabled ? "disabled" : ""}
        onclick="selectBookingEndTime('${time}')"
      >
        ${formatTime(time)}
      </button>
    `;
  }

  startContainer.innerHTML = startHTML;
  endContainer.innerHTML = endHTML;

  updateBookingTimeSummary();

}


window.selectBookingStartTime = function(time) {

  $("time").value = time;
  $("endTime").value = "";

  renderBookingTimePicker();

};


window.selectBookingEndTime = function(time) {

  const start = $("time").value;

  if (!start) {
    alert("Please select the start time first.");
    return;
  }

  const startMinutes = timeToMinutes(start);
  let endMinutes = timeToMinutes(time);

  /* Support overnight booking: 10:00 PM → 1:00 AM. */
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  if (endMinutes - startMinutes < 60) {
    alert("Minimum booking duration is 1 hour.");
    return;
  }

  $("endTime").value = time;

  renderBookingTimePicker();

};


function updateBookingTimeSummary() {

  const summary = $("bookingTimeSummary");

  if (!summary) {
    return;
  }

  const start = $("time").value;
  const end = $("endTime").value;

  if (!start) {
    summary.innerHTML =
      "Select a start time, then select an end time.";
    return;
  }

  if (!end) {
    summary.innerHTML = `
      <span>START</span>
      <strong>${formatTime(start)}</strong>
      <span class="summary-arrow">→</span>
      <span>Select end time</span>
    `;
    return;
  }

  summary.innerHTML = `
    <span>BOOKING TIME</span>
    <strong>
      ${formatTime(start)} → ${formatTime(end)}
    </strong>
  `;

}


function initializeBookingTimePicker() {

  renderBookingTimePicker();

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


  bookings.forEach(b => {

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


    map.get(key).bookings++;

  });


  const list =
    [...map.values()];


  if (!list.length) {

    container.innerHTML =
      `<div class="empty">
        No customers yet.
      </div>`;

    return;
  }


  container.innerHTML =
    list.map(c => {

      const initials =
        c.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0,2)
          .map(x => x[0])
          .join("")
          .toUpperCase();


      return `

        <div class="customer-card">

          <div class="customer-avatar">

            ${escapeHTML(
              initials || "C"
            )}

          </div>

          <h3>
            ${escapeHTML(
              c.name
            )}
          </h3>

          <p>
            ${escapeHTML(
              c.phone ||
              "No phone number"
            )}
          </p>

          <p>
            ${c.bookings}
            booking${c.bookings === 1 ? "" : "s"}
          </p>

        </div>

      `;

    }).join("");

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
        b.status !== "Cancelled"
    );


  const confirmed =
    bookings.filter(
      b =>
        b.status === "Confirmed"
    );


  const completed =
    bookings.filter(
      b =>
        b.status === "Completed"
    );


  const cancelled =
    bookings.filter(
      b =>
        b.status === "Cancelled"
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
        ${new Set(
          active
            .map(b => b.phone || b.customer)
            .filter(Boolean)
        ).size}
      </strong>

      <span>
        Unique Customers
      </span>

    </div>


    <div class="report-card">

      <strong>
        ${active.filter(
          b =>
            b.type ===
            "Birthday Surprise"
        ).length}
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

function showPage(page) {

  document
    .querySelectorAll(".page")
    .forEach(section => {

      section.classList.add(
        "hidden"
      );

    });


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
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    });


  if (
    window.innerWidth <= 900
  ) {

    document
      .querySelector("aside")
      ?.classList
      .remove("open");

  }


  if (
    page === "availability"
  ) {

    renderAvailability();

  }

}


document
  .querySelectorAll(
    "[data-page]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.page
        );

      }
    );

  });


document
  .querySelectorAll(
    "[data-add='booking']"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        openModal();

      }
    );

  });


/* =====================================================
   MOBILE MENU
===================================================== */

$("menu")
  .addEventListener(
    "click",
    () => {

      document
        .querySelector("aside")
        .classList
        .toggle("open");

    }
  );


/* =====================================================
   START
===================================================== */

initializeBookingTimePicker();
initializeAuth();
