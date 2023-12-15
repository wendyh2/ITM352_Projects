document.addEventListener("DOMContentLoaded", function() {
    function updateNavMenu() {
        var path = window.location.pathname.split('/').pop();

        var navItems = document.querySelectorAll('.navmenu a');

        navItems.forEach(item => {
            if (item.getAttribute('href') === path) {
                item.style.display = 'none';
            }
        });
    }

    updateNavMenu();
});
