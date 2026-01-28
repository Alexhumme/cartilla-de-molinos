export const GameStorage = {
    getName() { 
        return localStorage.getItem('playerName');
    },

    setName(name) {
        localStorage.setItem('playerName', name);
    },

    clear() {
        localStorage.removeItem('playerName');
    },

    hasName() {
        return !!localStorage.getItem('playerName');
    }
}