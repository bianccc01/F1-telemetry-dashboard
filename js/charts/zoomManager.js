window.ZoomManager = (function() {
    let currentTransform = d3.zoomIdentity;
    const listeners = [];

    function setTransform(transform) {
        currentTransform = transform;
        console.log("🔍 ZoomManager: Transform updated", { k: transform.k, x: transform.x, y: transform.y });

        // Notifica tutti i listener del cambiamento
        listeners.forEach(listener => {
            try {
                listener(currentTransform);
            } catch (error) {
                console.error("Error in zoom listener:", error);
            }
        });
    }

    function getTransform() {
        return currentTransform;
    }

    function reset() {
        console.log("🔄 ZoomManager: Resetting transform to identity");
        const oldTransform = currentTransform;
        currentTransform = d3.zoomIdentity;

        // Notifica i listener del reset solo se il transform è effettivamente cambiato
        if (oldTransform.k !== 1 || oldTransform.x !== 0 || oldTransform.y !== 0) {
            listeners.forEach(listener => {
                try {
                    listener(currentTransform);
                } catch (error) {
                    console.error("Error in zoom reset listener:", error);
                }
            });
        }
    }

    function addListener(listener) {
        if (typeof listener === 'function') {
            listeners.push(listener);
            console.log("➕ ZoomManager: Listener added, total:", listeners.length);
        } else {
            console.error("ZoomManager: Attempted to add non-function listener");
        }
    }

    function removeListener(listener) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
            console.log("➖ ZoomManager: Listener removed, total:", listeners.length);
        }
    }

    function clearAllListeners() {
        console.log("🧹 ZoomManager: Clearing all listeners");
        listeners.length = 0;
    }

    function isZoomed() {
        return currentTransform.k !== 1 || currentTransform.x !== 0 || currentTransform.y !== 0;
    }

    function getZoomInfo() {
        return {
            scale: currentTransform.k,
            translateX: currentTransform.x,
            translateY: currentTransform.y,
            isZoomed: isZoomed()
        };
    }

    // Inizializzazione: resetta lo zoom all'avvio
    d3.select(window).on('load', () => {
        console.log("🌐 ZoomManager: Window loaded, resetting transform");
        currentTransform = d3.zoomIdentity;
    });

    // Debug: esponi lo stato corrente per il debugging
    function debug() {
        console.log("🔍 ZoomManager Debug:", {
            transform: currentTransform,
            listeners: listeners.length,
            isZoomed: isZoomed(),
            zoomInfo: getZoomInfo()
        });
    }

    return {
        setTransform,
        getTransform,
        reset,
        addListener,
        removeListener,
        clearAllListeners,
        isZoomed,
        getZoomInfo,
        debug
    };
})();