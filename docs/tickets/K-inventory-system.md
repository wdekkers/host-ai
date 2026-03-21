# K — Property Inventory System

## Type
Feature

## Description
Track inventory per property, organized by rooms/areas. Each property has rooms (with sensible defaults), and each room has items with quantities. Staff can increment/decrement quantities to track what's available, what needs restocking, etc.

## Scope

### 1. Rooms / Areas
- Each property has a list of rooms/areas
- Default rooms created when a property is first set up:
  - Living Room, Kitchen, Master Bedroom, Bedroom 2, Bedroom 3,
    Bathroom 1, Bathroom 2, Garage, Patio/Outdoor, Pool Area, Laundry
- Owner/manager can add, rename, or remove rooms
- Rooms are property-specific

### 2. Items
- Each room has a list of inventory items
- Item fields: name, quantity, minimum quantity (for restock alerts)
- +/- buttons to adjust quantity inline
- Common item suggestions per room type (e.g. Kitchen: plates, cups, pans; Bathroom: towels, soap)

### 3. UI
- Property selector at the top (active properties only)
- Room tabs or sidebar to switch between rooms
- Item list with name, current quantity, min quantity, +/- controls
- "Add Item" form per room
- Visual indicator when quantity is at or below minimum (needs restock)

### 4. Sidebar
- "Inventory" entry under Operations
- Visible to owner, manager, agent, cleaner (cleaners can view and update quantities)

## Database changes
- `inventory_rooms` table: id, propertyId, name, sortOrder
- `inventory_items` table: id, roomId, name, quantity, minQuantity, updatedAt

## Permissions
- inventory.read — view inventory
- inventory.update — adjust quantities, add items
- inventory.create — add rooms
- inventory.delete — remove rooms/items
- Cleaners get inventory.read + inventory.update

## Acceptance criteria
- [ ] Property selector shows active properties
- [ ] Default rooms created for new properties
- [ ] Items can be added per room with +/- quantity controls
- [ ] Low-stock items highlighted when at or below minimum
- [ ] Cleaners can view and update quantities but not add/delete rooms
