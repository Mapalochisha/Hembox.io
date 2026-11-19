# Product-led catalogue and pricing

## Customer-facing model

The public catalogue uses a flexible parent/child relationship:

- **Product family** (`services.page_type = family`): an introductory page that explains a solution area and links to its child products. A family is not independently priced.
- **Product** (`services.page_type = product`): a standalone or family-linked service with its own URL, description, deliverables, pricing model and enquiry action.
- **Package** (`pricing_packages.service_id`): an option within a product. Packages are used when a single product has selectable tiers, such as SME Website → Starter / Professional.
- **Add-ons**: remain separate service/product records until a dedicated add-on relationship is introduced. Do not create fake packages for unrelated services.

A product can be standalone (`parent_service_id IS NULL`) or belong to a family. The relationship is intentionally only one level deep in the current storefront.

## Pricing models

`services.pricing_model` supports:

- `fixed`: display an exact amount.
- `starting_from`: display an indicative starting amount.
- `quote`: do not display an amount; invite a quotation.
- `packages`: display the product's active linked package tiers.

`price_amount`, `price_currency`, `price_suffix` and `pricing_note` belong to the service/product. Package prices and features belong to the linked `pricing_packages` records.

The universal `/pricing` page is retired and redirects visitors to the main services catalogue. Product pages are the canonical location for product prices.

## Enquiry context

Product enquiry actions submit:

- `service_id`
- `pricing_package_id` when a package is selected
- `product_snapshot` containing the service name, package name and displayed price
- the existing human-readable message context and page source

The snapshot records what the customer saw when submitting the enquiry; it is not a billing quote or a guarantee that a price cannot change. The HEMBOX team confirms the final scope and commercial terms.

## Admin workflow

1. Create or edit a service in **Admin → Service Offerings**.
2. In Service Details, choose **Parent product family** or **Individual product**.
3. Optionally select an active parent family.
4. Select the pricing model and configure the product price, currency, suffix and pricing note.
5. For `packages`, go to **Admin → Pricing Packages**, attach each tier to the product, and configure its price and features.
6. Publish the family and products independently.

## Initial website family

The migration creates **Website Design & Development** and organizes:

- Landing Pages — fixed price K4,500.
- SME Website — packages: Starter K7,500 and Professional K12,000.
- E-commerce & Online Ordering — starting from K20,000.

Logo Design, Brand Identity, Website Care & Maintenance, Workflow Automation and Custom Software & Business Systems remain standalone products with their existing public price positions.

Legacy SME Starter and SME Professional service records are retained as inactive records for historical reference. Their old public slugs redirect to the consolidated SME Website product.

## Migration and safety

Migration: `20261119140000_product_catalogue_pricing.sql`.

The migration is additive: it adds catalogue and enquiry columns, creates a family and consolidated SME product, links the current package rows, and deactivates the duplicate legacy SME service records. Existing enquiry records and domain/billing tables are not rewritten.