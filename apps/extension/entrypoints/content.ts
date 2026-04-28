export default defineContentScript({
  matches: ['*'],
  main() {
    //
    document.addEventListener("mouseup", () => {
      const text = window.getSelection()?.toString();
      if (text) {
        console.log(text);
      }
    });

  },
});
