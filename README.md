<img src="https://avatars.githubusercontent.com/u/184449885?s=400&u=7939c66f87f444b0cde413470336cd84c2b2c052&v=4" style="height: 150px; border-radius: 5px" />

# Dust

Dust is a media server focused around ebooks and comics. Think Plex, but for people who like to read (and more importantly, collect digital books and comics!).

## Folder Structure

Assuming you have a drive labled "M" and you want that drive to be indexed by Dust, you should structure your media like so:

```
M:
| > comics
| | > Marvel (this is a publisher)
| | | > Iron Man (this is a comic series)
| | | | > 44 (this is the series number)
| | | | | > iron_man_44.pdf (whatever the name of the file is)
| | | | | > iron_man_44_cover.jpg (the cover image for this comic)
| > books
| | > Henry James (this is an author)
| | | > The Portrait of a Lady (this is a book)
| | | | > portrait.epub (whatever the name of the file is)
| | | | > portrait_cover.jpg (the cover image for this book)
| | > Jeff Szuhay (this is an author)
| | | > Learn C Programming (this is a book)
| | | | > 9781789349917.epub (ISBN-based filename for metadata fetching)
| | | | > learn_c_cover.jpg (the cover image for this book)
```

### ISBN-Based Metadata Fetching

When organizing books, you can optionally use ISBN or ISBN-13 as the filename to enable automatic metadata fetching from external sources. If the filename is a valid ISBN/ISBN-13, Dust will automatically retrieve book metadata including title, author, publication date, and other details.

**Examples:**
- `9781789349917.epub` - Will fetch metadata for "Learn C Programming" by Jeff Szuhay
- `978-0-123456-78-9.pdf` - ISBN with hyphens (also supported)
- `regular_filename.epub` - Will still be processed but without automatic metadata fetching

## Development

Dust is written in Deno. Install Deno and run `deno task dev` to get started with local development.
