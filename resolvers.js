const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')
const Book = require('./models/book')
const Author = require('./models/author')
const User = require('./models/user')
const { PubSub } = require('graphql-subscriptions')
const author = require('./models/author')
const pubsub = new PubSub()

const resolvers = {
	Query: {
		bookCount: async () => await Book.collection.countDocuments(),
		authorCount: async () => await Author.collection.countDocuments(),

		allBooks: async (root, args) => {
			const query = {}

			if (args.author) {
				const author = await Author.findOne({ name: args.author })
				if (author) {
					query.author = author._id
				} else {
					return []
				}
			}
			if (args.genre) {
				query.genres = { $in: [args.genre] }
			}
			console.log(query)
			const books = await Book.find(query).populate('author')
			console.log(books)
			const booksWithAuthorInfo = books.map(book => {
				const bookCount = book.author.books ? book.author.books.length : 0
				return {
					...book.toJSON(),//by calling toJSON() before returning it in your resolver, you ensure that the transformation defined in the schema's toJSON method is applied, and the _id field is correctly transformed to id in the JSON response.It's nesessary to do when you use spread operator.
					author: {
						...book.author.toJSON(),
						bookCount,
					}
				}
			})
			return booksWithAuthorInfo
		},

		allAuthors: async () => {
			const authors = await Author.find({}).populate('books')
			console.log('Author.find')

			const authorFullInfo = authors.map(author => {
				const bookCount = author.books ? author.books.length : 0
				console.log(bookCount)
				return {
					...author.toJSON(),
					bookCount
				}
			})
			return authorFullInfo
		},

		findAuthor: async (root, args) => {
			let author = await Author.findOne({ name: args.name }).populate('books')
			if (!author) {
				return null
			}
			const bookCount = author.books.length

			return {
				...author.toJSON(),
				bookCount,
			}
		},

		findBook: async (root, args) => {
			const book = await Book.findOne({ title: args.title }).populate('author')
			console.log(book)
			if (!book) {
				return null
			}
			console.log(book.author)

			const authorBooks = await Book.find({ author: book.author._id })
			const bookCount = authorBooks.length

			return {
				...book.toJSON(),
				author: {
					...book.author.toJSON(),
					bookCount,
					books: authorBooks,
				}
			}
		},

		me: (root, args, context) => {
			return context.currentUser
		},
	},

	Mutation: {
		addBook: async (root, args, context) => {
			if (args.title.length < 5) {
				throw new GraphQLError('Book title must be at least 5 characters long')
			}
			if (args.author.length < 4) {
				throw new GraphQLError('Author name must be at least 4 characters long')
			}

			const currentUser = context.currentUser
			if (!currentUser) {
				throw new GraphQLError('not authenticated', {
					extensions: { code: 'BAD_USER_INPUT', }
				})
			}

			let author = await Author.findOne({ name: args.author })
			if (!author) {
				author = new Author({ name: args.author })
				try {
					await author.save()
					pubsub.publish('AUTHOR_ADDED', { authorAdded: author })
				} catch (error) {
					throw new GraphQLError('Saving person failed', {
						extensions: {
							code: 'BAD_USER_INPUT',
							invalidArgs: args.name,
							error
						}
					})
				}
			}
			const book = new Book({ ...args, author: author._id })
			const currentUser = context.currentUser
			if (!currentUser) {
				throw new GraphQLError('not authenticated', {
					extensions: { code: 'BAD_USER_INPUT', }
				})
			}
			try {
				await book.save()
			} catch (error) {
				throw new GraphQLError('Saving book failed', {
					extensions: {
						code: 'BAD_USER_INPUT',
						invalidArgs: args.name,
						error
					}
				})
			}
			// Push the book's _id to the author's books array
			author.books = author.books.concat(book._id)
			await author.save()
			await book.populate('author')

			const authorBooks = await Book.find({ author: book.author._id })
			const bookCount = authorBooks.length
			console.log(book)
			pubsub.publish('BOOK_ADDED', { bookAdded: book })
			return {
				...book.toJSON(),
				author: {
					...book.author.toJSON(),
					bookCount,
					books: authorBooks,
				}
			}
		},

		editAuthor: async (root, args, context) => {
			const author = await Author.findOne({ name: args.name })
			const currentUser = context.currentUser
			if (!currentUser) {
				throw new GraphQLError('not authenticated', {
					extensions: { code: 'BAD_USER_INPUT', }
				})
			}

			if (!author) {
				return null
			}

			author.born = args.setBornTo
			await author.save()
			const authorBooks = await Book.find({ author: author._id })
			const bookCount = authorBooks.length
			return {
				...author.toJSON(),
				bookCount,
				books: authorBooks,
			}
		},

		createUser: async (root, args) => {
			const user = new User({
				username: args.username,
				favoriteGenre: args.favoriteGenre,
			})

			return user.save()
				.catch(error => {
					throw new GraphQLError('Creating the user failed', {
						extensions: {
							code: 'BAD_USER_INPUT',
							invalidArgs: args.name,
							error
						}
					})
				})
		},

		login: async (root, args) => {
			const user = await User.findOne({ username: args.username })

			if (!user || args.password !== 'secret') {
				throw new GraphQLError('wrong credentials', {
					extensions: {
						code: 'BAD_USER_INPUT'
					}
				})
			}

			const userForToken = {
				username: user.username,
				id: user._id,
			}

			return { value: jwt.sign(userForToken, process.env.JWT_SECRET) }
		},
	},
	Subscription: {
		bookAdded: {
			subscribe: () => pubsub.asyncIterator('BOOK_ADDED'),
		},
		authorAdded: {
			subscribe: () => pubsub.asyncIterator('AUTHOR_ADDED'),
		},
	},
}

module.exports = resolvers