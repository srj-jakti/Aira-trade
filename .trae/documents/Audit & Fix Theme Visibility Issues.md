I have identified several key files that are using hardcoded "Dark Mode" colors (white text, black backgrounds) which makes them invisible or broken in Light Mode.

Here is the plan to fix them by switching to dynamic theme colors:

### **1. Admin Dashboard (`src/app/(protected)/admin/page.tsx`)**
*   **Issue:** Heavily uses `text-white`, `bg-white/5`, and `border-white/10`.
*   **Fix:**
    *   Replace `bg-white/5` → `bg-card`
    *   Replace `border-white/10` → `border-border`
    *   Replace `text-white` → `text-foreground`
    *   Replace `text-white/40` → `text-muted-foreground`

### **2. Brain Status Dashboard (`src/components/BrainStatusDashboard.tsx`)**
*   **Issue:** Hardcoded status badges and text colors.
*   **Fix:** Update all `text-white` and `bg-slate-900` to semantic theme variables.

### **3. Authentication Pages (`src/app/(auth)/signin/page.tsx`)**
*   **Issue:** Login forms are hardcoded for dark mode.
*   **Fix:** Ensure input fields and labels are visible in light mode (`bg-background`, `text-foreground`).

### **4. Legal Pages (`src/app/legal/...`)**
*   **Issue:** Risk Disclosure and Privacy pages have hardcoded `bg-black`.
*   **Fix:** Change to `bg-background` to respect the system theme.

### **5. Component Cleanup**
*   **Files:** `MarketChart.tsx`, `trading-toolbox.tsx`, `Logo.tsx`.
*   **Fix:** Remove residual hardcoded white text classes.

I will proceed file-by-file to ensure that every element is visible in both Light and Dark themes.