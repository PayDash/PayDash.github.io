const icons = document.querySelectorAll('.role-icon');
icons.forEach(function(icon) {
    icon.addEventListener('click', function() {
        icons.forEach(function(iconn) {
            if (iconn !== icon) {
                iconn.classList.remove('active');
            }
        });
        icon.classList.toggle('active');
    });
});

//audio

document.addEventListener("DOMContentLoaded", function () {
    const audio = document.getElementById('audio');
    const volumeRange = document.getElementById('volumeRange');
    const sources = Array.from(audio.getElementsByTagName('source'));
  
    audio.volume = volumeRange.value / 100;
  
    volumeRange.addEventListener('input', function () {
        audio.volume = this.value / 100;
    });
  
    function playRandomTrack() {
        const randomIndex = Math.floor(Math.random() * sources.length);
        audio.src = sources[randomIndex].src;
        audio.load(); // Load the new audio source
        audio.play();
    }
  
    audio.addEventListener('ended', playRandomTrack);
  
    playRandomTrack();
  });

  
//draggable shit


document.addEventListener('DOMContentLoaded', function() {
    const border = document.querySelector('.border');
    let isDragging = false;
    let startX, startY, initialX, initialY;

    border.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = border.offsetLeft;
        initialY = border.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            border.style.left = `${initialX + dx}px`;
            border.style.top = `${initialY + dy}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
});



