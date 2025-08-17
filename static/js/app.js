// --- Firebase Config ---
// REPLACE the below object with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCk0wkFK4AUYz23dAh25rHBvnuA0mjghBY",
  authDomain: "aistudyplanner-7aab4.firebaseapp.com",
  projectId: "aistudyplanner-7aab4",
  storageBucket: "aistudyplanner-7aab4.firebasestorage.app",
  messagingSenderId: "1078077767068",
  appId: "1:1078077767068:web:11856b7487acbe12d59c59"
};

firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// --- Preloader & Animations ---
gsap.to(".progress-bar", {
    width: "100%",
    duration: 2,
    ease: "power2.out",
    onComplete: () => {
        gsap.to(".preloader", {
            opacity: 0,
            scale: 0.9,
            duration: 1,
            delay: 0.5,
            onComplete: () => {
                document.querySelector(".preloader").style.display = "none";
                document.querySelector(".main-content").classList.add("visible");
                initAnimations();
                loadTasks(); // Load tasks after main content is visible
            }
        });
    }
});

function initAnimations() {
    gsap.from(".hero h1", { opacity: 0, y: 50, duration: 1, delay: 0.3 });
    gsap.from(".hero p", { opacity: 0, y: 30, duration: 1, delay: 0.6 });
    gsap.from(".hero-button", { opacity: 0, y: 30, duration: 1, delay: 0.9, ease: "back.out(1.7)" });

    gsap.from(".feature-card", {
        scrollTrigger: {
            trigger: ".features-grid",
            start: "top 80%",
            toggleActions: "play none none none"
        },
        opacity: 0,
        y: 50,
        stagger: 0.2,
        duration: 0.8,
        ease: "back.out(1.2)"
    });

    document.querySelectorAll('.cta-button, .feature-card').forEach(el => {
        el.addEventListener('mouseenter', () => gsap.to(el, { scale: 1.05, duration: 0.3 }));
        el.addEventListener('mouseleave', () => gsap.to(el, { scale: 1, duration: 0.3 }));
    });

    document.querySelectorAll('.card-3d').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            gsap.to(card, {
                rotateX: (y - centerY) / 20,
                rotateY: (centerX - x) / 20,
                duration: 0.5
            });
        });
        card.addEventListener('mouseleave', () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.5 }));
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('mouseenter', () => gsap.to(link, { color: '#a29bfe', duration: 0.3 }));
        link.addEventListener('mouseleave', () => gsap.to(link, { color: '#f5f6fa', duration: 0.3 }));
    });
}

// --- Chatbot Logic ---
const chatWindow = document.getElementById("chat-window");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

function addMessage(sender, text) {
    const msg = document.createElement("div");
    msg.classList.add("chat-message", sender);
    msg.innerHTML = `<p>${text}</p>`;
    chatWindow.appendChild(msg);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage("user", message);
    chatInput.value = "";

    const thinkingMsg = document.createElement("div");
    thinkingMsg.classList.add("chat-message", "bot");
    thinkingMsg.innerHTML = `<p>Thinking... 🤔</p>`;
    chatWindow.appendChild(thinkingMsg);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    fetch("/chat_ai", {   // <-- change /chat to /chat_ai
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
})
.then(res => res.json())
.then(data => {
    thinkingMsg.innerHTML = `<p>${data.reply}</p>`;
    chatWindow.scrollTop = chatWindow.scrollHeight;
})
.catch(err => {
    thinkingMsg.innerHTML = `<p>Error: Could not connect to server.</p>`;
    console.error(err);
});
}

sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
    }
});

// --- Study Schedule Logic ---
const taskNameInput = document.getElementById("task-name");
const subjectNameInput = document.getElementById("subject-name");
const taskDateInput = document.getElementById("task-date");
const addTaskBtn = document.getElementById("add-task-btn");
const tasksList = document.getElementById("tasks-list");

// Add / Edit state
let editTaskId = null;

// Load tasks from Firebase
function loadTasks() {
    tasksList.innerHTML = "";

    db.collection("tasks").get()
    .then(snapshot => {
        tasks = [];
        snapshot.forEach(doc => {
            tasks.push({ id: doc.id, ...doc.data() });
        });

        // Sort tasks by datetime (earliest first)
        tasks.sort((a, b) => new Date(a.taskDate) - new Date(b.taskDate));

        tasks.forEach(task => {
            const card = document.createElement("div");
            card.classList.add("task-card");
            if (task.completed) card.classList.add("completed");

            card.innerHTML = `
                <div style="display:flex; justify-content: flex-end;">
                    <input type="checkbox" class="complete-checkbox" ${task.completed ? "checked" : ""}>
                </div>
                <h3>${task.taskName}</h3>
                <p><strong>Subject:</strong> ${task.subjectName}</p>
                <p><strong>Time:</strong> ${new Date(task.taskDate).toLocaleString()}</p>
                <div style="display:flex; justify-content: space-between; margin-top:10px;">
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                </div>
            `;

            // Checkbox toggle
            card.querySelector(".complete-checkbox").addEventListener("change", (e) => {
                db.collection("tasks").doc(task.id).update({ completed: e.target.checked })
                .then(() => loadTasks());
            });

            // Delete button
            card.querySelector(".delete-btn").addEventListener("click", () => {
                db.collection("tasks").doc(task.id).delete().then(() => loadTasks());
            });

            // Edit button
            card.querySelector(".edit-btn").addEventListener("click", () => {
                taskNameInput.value = task.taskName;
                subjectNameInput.value = task.subjectName;
                taskDateInput.value = task.taskDate;
                editTaskId = task.id;
                addTaskBtn.textContent = "Update Task";
            });

            tasksList.appendChild(card);
        });
    })
    .catch(error => console.error("Error loading tasks:", error));
}

// Add / Update task
addTaskBtn.addEventListener("click", () => {
    const taskName = taskNameInput.value.trim();
    const subjectName = subjectNameInput.value.trim();
    const taskDate = taskDateInput.value;

    if (!taskName || !subjectName || !taskDate) {
        alert("Please fill all fields.");
        return;
    }

    if (editTaskId) {
        // Update existing task
        db.collection("tasks").doc(editTaskId).update({
            taskName, subjectName, taskDate
        }).then(() => {
            editTaskId = null;
            addTaskBtn.textContent = "Add Task";
            taskNameInput.value = "";
            subjectNameInput.value = "";
            taskDateInput.value = "";
            loadTasks();
        });
    } else {
        // Add new task
        db.collection("tasks").add({
            taskName, subjectName, taskDate, completed: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            taskNameInput.value = "";
            subjectNameInput.value = "";
            taskDateInput.value = "";
            loadTasks();
        });
    }
});


// Load tasks on page load
window.addEventListener("DOMContentLoaded", () => {
    loadTasks();
});


/* ===== Quiz Frontend Logic ===== */
(() => {
  const topicInput = document.getElementById("quiz-topic");
  const diffSelect = document.getElementById("quiz-difficulty");
  const genBtn = document.getElementById("quiz-generate");
  const loader = document.getElementById("quiz-loader");
  const card = document.getElementById("quiz-card");
  const result = document.getElementById("quiz-result");
  const errorBox = document.getElementById("quiz-error");
  const quizQuestion = document.getElementById("quiz-question");
  const quizOptions = document.getElementById("quiz-options");
  const quizProgress = document.getElementById("quiz-progress");
  const quizScore = document.getElementById("quiz-score");
  const submitBtn = document.getElementById("quiz-submit");
  const nextBtn = document.getElementById("quiz-next");
  const feedback = document.getElementById("quiz-feedback");
  const resultTitle = document.getElementById("quiz-result-title");
  const resultSummary = document.getElementById("quiz-result-summary");
  const retryBtn = document.getElementById("quiz-retry");

  let questions = [];
  let idx = 0;
  let score = 0;
  let chosen = null;

  /* ===== Loader Control ===== */
  function showLoader(show) {
    loader.hidden = !show; // only visible when fetching
    card.hidden = show;    // hide card while loading
    result.hidden = true;
    errorBox.hidden = true;
  }

  /* ===== Error Display ===== */
  function showError(msg) {
    errorBox.hidden = false;
    errorBox.querySelector("p").textContent = msg || "Something went wrong.";
    showLoader(false);
  }

  /* ===== Fetch Quiz from Server ===== */
  async function fetchQuiz(topic, difficulty) {
    showLoader(true); // show loader while fetching
    try {
      const res = await fetch("/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, difficulty })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Quiz generation failed");
      return data.questions;
    } catch (err) {
      showError(err.message || "Could not generate quiz.");
      throw err;
    } finally {
      showLoader(false); // hide loader after fetch
    }
  }

  /* ===== Render Quiz Question ===== */
  function renderQuestion(i) {
    chosen = null;
    const q = questions[i];
    quizProgress.textContent = `Q ${i + 1}/${questions.length}`;
    quizScore.textContent = `Score: ${score}`;
    quizQuestion.textContent = q.question;
    quizOptions.innerHTML = "";
    feedback.hidden = true;
    submitBtn.disabled = false;
    nextBtn.disabled = true;

    q.options.forEach((opt, j) => {
      const id = `opt-${i}-${j}`;
      const wrapper = document.createElement("label");
      wrapper.className = "quiz-option";
      wrapper.htmlFor = id;
      wrapper.innerHTML = `
        <input type="radio" name="quiz-opt" id="${id}" data-index="${j}">
        <span class="opt-text">${opt}</span>
      `;
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.padding = "10px 12px";
      wrapper.style.marginBottom = "10px";
      wrapper.style.borderRadius = "10px";
      wrapper.style.background = "rgba(255,255,255,0.02)";
      wrapper.style.border = "1px solid rgba(255,255,255,0.03)";
      wrapper.style.cursor = "pointer";

      const input = wrapper.querySelector("input");
      input.style.accentColor = "rgba(108,92,231,0.95)";
      input.addEventListener("change", (e) => {
        chosen = parseInt(e.target.dataset.index, 10);
      });

      quizOptions.appendChild(wrapper);
    });

    // Add padding below options for spacing from buttons
    quizOptions.style.marginBottom = "16px";
  }

  /* ===== Feedback Display ===== */
  function showFeedback(isCorrect, explanation) {
    feedback.hidden = false;
    feedback.innerHTML = isCorrect
      ? `<strong>Correct ✅</strong><div>${explanation}</div>`
      : `<strong>Incorrect ❌</strong><div>${explanation}</div>`;
  }

  /* ===== Submit Answer ===== */
  submitBtn.addEventListener("click", () => {
    if (chosen === null) return alert("Select an answer first.");
    submitBtn.disabled = true;
    const q = questions[idx];
    const isCorrect = (chosen === q.answer);
    if (isCorrect) score++;
    showFeedback(isCorrect, q.explanation);
    quizScore.textContent = `Score: ${score}`;
    nextBtn.disabled = false;
  });

  /* ===== Next Question ===== */
  nextBtn.addEventListener("click", () => {
    idx++;
    if (idx >= questions.length) {
      // show final result
      card.hidden = true;
      result.hidden = false;
      let title = "Nice work!";
      let summary = `You scored ${score}/${questions.length}.`;
      if (score === questions.length) {
        title = "Excellent! 🎉";
        summary = "Perfect score! Keep up the amazing work!";
      } else if (score >= Math.ceil(questions.length * 0.6)) {
        title = "Great job!";
        summary = "Good progress — keep practicing to get even better!";
      } else {
        title = "Keep going!";
        summary = "Don't worry — with practice you'll improve. Try another quiz!";
      }
      resultTitle.textContent = title;
      resultSummary.textContent = summary;
      return;
    }
    renderQuestion(idx);
  });

  /* ===== Retry Quiz ===== */
  retryBtn.addEventListener("click", () => {
    questions = [];
    idx = 0;
    score = 0;
    chosen = null;
    card.hidden = true;
    result.hidden = true;
  });

  /* ===== Generate Quiz ===== */
  genBtn.addEventListener("click", async () => {
    const topic = topicInput.value.trim();
    const difficulty = diffSelect.value || "auto";
    if (!topic) return alert("Please enter a topic");

    try {
      showLoader(true); // show loader
      questions = await fetchQuiz(topic, difficulty);
      if (!Array.isArray(questions) || questions.length !== 5) throw new Error("Bad quiz data");

      idx = 0;
      score = 0;
      chosen = null;
      renderQuestion(0);
      card.hidden = false;
      feedback.hidden = true;
      showLoader(false); // hide loader after quiz is ready
    } catch (err) {
      showLoader(false);
      showError(err.message || "Could not generate quiz.");
      console.error(err);
    }
  });

})();