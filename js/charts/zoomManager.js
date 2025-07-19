window.ZoomManager = (function() {
    let currentTransform = d3.zoomIdentity;

    const listeners = [];

    function setTransform(transform) {
        currentTransform = transform;
        // Notifica tutti i listener del cambiamento
        listeners.forEach(listener => listener(currentTransform));
    }

    function getTransform() {
        return currentTransform;
    }

    function addListener(listener) {
        listeners.push(listener);
    }

    function removeListener(listener) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    // Inizializzazione: resetta lo zoom all'avvio
    d3.select(window).on('load', () => {
        currentTransform = d3.zoomIdentity;
    });

    return {
        setTransform,
        getTransform,
        addListener,
        removeListener
    };
})();
