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
```

## Development

Dust is written in Deno. Install Deno and run `deno task dev` to get started with local development.