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

    fetch("/chat", {
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
