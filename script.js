(function () {
  const board = document.getElementById('board');
  const currentDateDisplay = document.getElementById('currentDateDisplay');
  const datePicker = document.getElementById('datePicker');
  const prevDayBtn = document.getElementById('prevDayBtn');
  const nextDayBtn = document.getElementById('nextDayBtn');

  const COLUMN_COUNT = 5;
  const CENTER_INDEX = 2;
  const STORAGE_KEY = 'vibeDiaryTasks';

  const columns = [];

  function loadAllTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveAllTasks(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  const tasksByDate = loadAllTasks();

  function getTasksForDate(dateKey) {
    return tasksByDate[dateKey] || [];
  }

  function addTask(dateKey, text, priority) {
    const list = tasksByDate[dateKey] ? tasksByDate[dateKey].slice() : [];
    list.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text,
      priority,
      completed: false,
      isOverdue: false
    });
    tasksByDate[dateKey] = list;
    saveAllTasks(tasksByDate);
    return list;
  }

  function toggleTaskCompleted(dateKey, taskId) {
    const list = tasksByDate[dateKey] || [];
    tasksByDate[dateKey] = list.map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed, isOverdue: false } : task
    );
    saveAllTasks(tasksByDate);
  }

  function updateTaskText(dateKey, taskId, newText) {
    const list = tasksByDate[dateKey] || [];
    tasksByDate[dateKey] = list.map((task) =>
      task.id === taskId ? { ...task, text: newText } : task
    );
    saveAllTasks(tasksByDate);
  }

  function deleteTask(dateKey, taskId) {
    const list = tasksByDate[dateKey] || [];
    tasksByDate[dateKey] = list.filter((task) => task.id !== taskId);
    saveAllTasks(tasksByDate);
  }

  function moveTask(fromDateKey, toDateKey, taskId) {
    const fromList = tasksByDate[fromDateKey] || [];
    const taskIndex = fromList.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) return;

    const [task] = fromList.splice(taskIndex, 1);
    tasksByDate[fromDateKey] = fromList;

    const toList = tasksByDate[toDateKey] ? tasksByDate[toDateKey].slice() : [];
    toList.push({ ...task, isOverdue: false });
    tasksByDate[toDateKey] = toList;

    saveAllTasks(tasksByDate);
  }

  function runOverdueEngine(todayKey) {
    let changed = false;

    Object.keys(tasksByDate).forEach((dateKey) => {
      if (dateKey >= todayKey) return;

      const list = tasksByDate[dateKey] || [];
      if (!list.length) return;

      const remaining = [];
      list.forEach((task) => {
        if (task.completed) {
          remaining.push(task);
          return;
        }
        const todayList = tasksByDate[todayKey] ? tasksByDate[todayKey].slice() : [];
        todayList.push({ ...task, isOverdue: true });
        tasksByDate[todayKey] = todayList;
        changed = true;
      });
      tasksByDate[dateKey] = remaining;
    });

    if (changed) {
      saveAllTasks(tasksByDate);
    }
  }

  function renderTaskList(taskListEl, tasks, dateKey) {
    taskListEl.innerHTML = '';

    if (!tasks.length) {
      const empty = document.createElement('li');
      empty.className = 'task-empty';
      empty.textContent = 'Пока пусто';
      taskListEl.appendChild(empty);
      return;
    }

    const sortedTasks = tasks
      .slice()
      .sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));

    sortedTasks.forEach((task) => {
      const item = document.createElement('li');
      item.className = `task-item priority-${task.priority}`;
      if (task.completed) {
        item.classList.add('completed');
      }
      if (task.isOverdue) {
        item.classList.add('overdue');
      }

      item.draggable = true;
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(
          'text/plain',
          JSON.stringify({ dateKey, taskId: task.id })
        );
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
      });

      const marker = document.createElement('span');
      marker.className = 'task-marker';

      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;
      text.addEventListener('click', () => {
        toggleTaskCompleted(dateKey, task.id);
        refreshBoard();
      });

      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'task-edit';
      editBtn.title = 'Исправить';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', () => {
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.className = 'task-edit-input';
        editInput.maxLength = 200;
        editInput.value = task.text;

        item.replaceChild(editInput, text);
        editInput.focus();
        editInput.select();

        let cancelled = false;

        editInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            editInput.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelled = true;
            editInput.blur();
          }
        });

        editInput.addEventListener('blur', () => {
          if (!cancelled) {
            const newText = editInput.value.trim();
            if (newText && newText !== task.text) {
              updateTaskText(dateKey, task.id, newText);
            }
          }
          refreshBoard();
        });
      });

      const moveBtn = document.createElement('button');
      moveBtn.type = 'button';
      moveBtn.className = 'task-move';
      moveBtn.title = 'Перенести';
      moveBtn.textContent = '→';

      const moveInput = document.createElement('input');
      moveInput.type = 'date';
      moveInput.className = 'task-move-input';
      moveInput.tabIndex = -1;
      moveInput.value = dateKey;

      moveBtn.addEventListener('click', () => {
        if (typeof moveInput.showPicker === 'function') {
          moveInput.showPicker();
        } else {
          moveInput.focus();
          moveInput.click();
        }
      });

      moveInput.addEventListener('change', () => {
        const newDateKey = moveInput.value;
        if (!newDateKey || newDateKey === dateKey) return;
        moveTask(dateKey, newDateKey, task.id);
        refreshBoard();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'task-delete';
      deleteBtn.title = 'Удалить';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', () => {
        deleteTask(dateKey, task.id);
        refreshBoard();
      });

      actions.appendChild(editBtn);
      actions.appendChild(moveBtn);
      actions.appendChild(moveInput);
      actions.appendChild(deleteBtn);

      item.appendChild(marker);
      item.appendChild(text);
      item.appendChild(actions);
      taskListEl.appendChild(item);
    });
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function toInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatLongDate(date) {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function formatDayName(date) {
    return capitalize(date.toLocaleDateString('ru-RU', { weekday: 'long' }));
  }

  function formatShortDate(date) {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }

  function buildColumns() {
    for (let i = 0; i < COLUMN_COUNT; i++) {
      const column = document.createElement('section');
      column.className = 'day-column';

      const header = document.createElement('header');
      header.className = 'day-header';

      const dayName = document.createElement('span');
      dayName.className = 'day-name';

      const dayDate = document.createElement('span');
      dayDate.className = 'day-date';

      header.appendChild(dayName);
      header.appendChild(dayDate);

      const content = document.createElement('div');
      content.className = 'day-content';

      const taskList = document.createElement('ul');
      taskList.className = 'task-list';

      const form = document.createElement('form');
      form.className = 'task-form';
      form.noValidate = true;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'task-input';
      input.placeholder = 'Новая задача...';
      input.maxLength = 200;

      const select = document.createElement('select');
      select.className = 'task-priority';
      [
        { value: 'high', label: '🔴 Высокий' },
        { value: 'medium', label: '🟡 Средний' },
        { value: 'low', label: '🟢 Низкий' }
      ].forEach((priority) => {
        const option = document.createElement('option');
        option.value = priority.value;
        option.textContent = priority.label;
        if (priority.value === 'medium') {
          option.selected = true;
        }
        select.appendChild(option);
      });

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = input.value.trim();
        const dateKey = column.dataset.date;
        if (!text || !dateKey) return;

        addTask(dateKey, text, select.value);
        input.value = '';
        input.focus();
        refreshBoard();
      });

      form.appendChild(input);
      form.appendChild(select);

      content.appendChild(taskList);
      content.appendChild(form);

      column.appendChild(header);
      column.appendChild(content);

      column.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        column.classList.add('drag-over');
      });

      column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
      });

      column.addEventListener('drop', (event) => {
        event.preventDefault();
        column.classList.remove('drag-over');

        const raw = event.dataTransfer.getData('text/plain');
        if (!raw) return;

        let payload;
        try {
          payload = JSON.parse(raw);
        } catch (e) {
          return;
        }

        const toDateKey = column.dataset.date;
        if (!toDateKey || !payload.dateKey || payload.dateKey === toDateKey) return;

        moveTask(payload.dateKey, toDateKey, payload.taskId);
        refreshBoard();
      });

      board.appendChild(column);

      columns.push({ root: column, dayName, dayDate, taskList, input, select });
    }
  }

  function renderBoard(centerDate) {
    for (let i = 0; i < COLUMN_COUNT; i++) {
      const offset = i - CENTER_INDEX;
      const date = addDays(centerDate, offset);
      const column = columns[i];
      const dateKey = toInputValue(date);

      column.dayName.textContent = formatDayName(date);
      column.dayDate.textContent = formatShortDate(date);
      column.root.dataset.date = dateKey;

      column.root.classList.remove('past', 'today', 'future');
      if (offset < 0) {
        column.root.classList.add('past');
      } else if (offset === 0) {
        column.root.classList.add('today');
      } else {
        column.root.classList.add('future');
      }

      column.input.disabled = offset < 0;
      column.select.disabled = offset < 0;

      renderTaskList(column.taskList, getTasksForDate(dateKey), dateKey);
    }
  }

  let currentCenterDate = new Date();

  function refreshBoard() {
    renderBoard(currentCenterDate);
  }

  function shiftCenterDate(amount) {
    currentCenterDate = addDays(currentCenterDate, amount);
    datePicker.value = toInputValue(currentCenterDate);
    refreshBoard();
  }

  function init() {
    currentCenterDate = new Date();
    const todayKey = toInputValue(currentCenterDate);

    runOverdueEngine(todayKey);

    currentDateDisplay.textContent = formatLongDate(currentCenterDate);
    datePicker.value = todayKey;

    buildColumns();
    refreshBoard();

    datePicker.addEventListener('change', () => {
      if (!datePicker.value) return;
      const [year, month, day] = datePicker.value.split('-').map(Number);
      currentCenterDate = new Date(year, month - 1, day);
      refreshBoard();
    });

    prevDayBtn.addEventListener('click', () => shiftCenterDate(-1));
    nextDayBtn.addEventListener('click', () => shiftCenterDate(1));

    document.addEventListener('keydown', (event) => {
      const tag = event.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (event.key === 'ArrowLeft') {
        shiftCenterDate(-1);
      } else if (event.key === 'ArrowRight') {
        shiftCenterDate(1);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
