
// Standalone Timer Script
(function () {
    const target = new Date("January 19, 2026 00:00:00").getTime();
    const display = document.getElementById("countdown-display");
    const circle = document.getElementById("progress-ring-circle");
    let circumference = 0;

    if (circle) {
        const radius = circle.r.baseVal.value;
        circumference = radius * 2 * Math.PI;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = circumference;
    }

    function updateTimer() {
        const now = Date.now();
        let dist = target - now;
        if (dist < 0) dist = 0;

        const d = Math.floor(dist / (1000 * 60 * 60 * 24));
        const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((dist % (1000 * 60)) / 1000);

        // Update Text
        if (display) {
            display.innerHTML = `
                <span class="unit">${String(d).padStart(2, '0')}<small>d</small></span>:
                <span class="unit">${String(h).padStart(2, '0')}<small>h</small></span>:
                <span class="unit">${String(m).padStart(2, '0')}<small>m</small></span>:
                <span class="unit">${String(s).padStart(2, '0')}<small>s</small></span>
            `;
        }

        // Update Ring (Seconds ticker)
        if (circle) {
            // Smooth tick for seconds (s + ms)
            // Or just step based on s? Let's use ms for smooth
            const ms = dist % 1000;
            const smoothS = s + (ms / 1000);
            // 60 seconds loop
            const offset = circumference - ((60 - s) / 60) * circumference;
            // Actually usually it goes full -> empty or empty -> full.
            // Let's make it fill up or drain.
            // Drain:
            circle.style.strokeDashoffset = circumference * (s / 60);
        }

        requestAnimationFrame(updateTimer);
    }

    // Start
    updateTimer();
    console.log("Timer started");
})();
