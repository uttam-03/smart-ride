/* Smart Ride: lightweight entrance animations. No dependencies; respects reduced-motion settings. */
(() => {
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const decorate = (root) => {
    const selectors = '.container > .grid, .container > .section-header, .container > .table-wrap, .container > .card, .auth-card, .dashboard-section, .stats-grid, .grid > .card, .grid > section';
    const nodes = root.querySelectorAll ? root.querySelectorAll(selectors) : [];
    nodes.forEach((node, index) => {
      if (node.classList.contains('sr-reveal')) return;
      node.classList.add('sr-reveal');
      node.classList.add(`sr-delay-${(index % 3) + 1}`);
      observer ? observer.observe(node) : node.classList.add('sr-visible');
    });
  };

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('sr-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }) : null;

  const init = () => {
    decorate(document);
    // Also animate cards inserted later by dashboard/API rendering.
    const mutationObserver = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.matches?.('.card, .grid, .table-wrap, .dashboard-section')) decorate(node.parentElement || node);
          decorate(node);
        }
      }));
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
