const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const mongoose = require('mongoose')
mongoose.set('strictQuery', false)
require('dotenv').config()
const Book = require('./models/book')
const Author = require('./models/author')
const book = require('./models/book')


const MONGODB_URI = process.env.MONGODB_URI

console.log('connecting to', MONGODB_URI)

mongoose.connect(MONGODB_URI)
	.then(() => {
		console.log('connected to MongoDB')
	})
	.catch((error) => {
		console.log('error connection to MongoDB:', error.message)
	})


let authors = [
	{
		name: 'Robert Martin',
		id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
		born: 1952,
	},
	{
		name: 'Martin Fowler',
		id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
		born: 1963
	},
	{
		name: 'Fyodor Dostoevsky',
		id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
		born: 1821
	},
	{
		name: 'Joshua Kerievsky', // birthyear not known
		id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
	},
	{
		name: 'Sandi Metz', // birthyear not known
		id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
	},
]


let books = [
	{
		title: 'Clean Code',
		published: 2008,
		author: 'Robert Martin',
		id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
		genres: ['refactoring']
	},
	{
		title: 'Agile software development',
		published: 2002,
		author: 'Robert Martin',
		id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
		genres: ['agile', 'patterns', 'design']
	},
	{
		title: 'Refactoring, edition 2',
		published: 2018,
		author: 'Martin Fowler',
		id: "afa5de00-344d-11e9-a414-719c6709cf3e",
		genres: ['refactoring']
	},
	{
		title: 'Refactoring to patterns',
		published: 2008,
		author: 'Joshua Kerievsky',
		id: "afa5de01-344d-11e9-a414-719c6709cf3e",
		genres: ['refactoring', 'patterns']
	},
	{
		title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
		published: 2012,
		author: 'Sandi Metz',
		id: "afa5de02-344d-11e9-a414-719c6709cf3e",
		genres: ['refactoring', 'design']
	},
	{
		title: 'Crime and punishment',
		published: 1866,
		author: 'Fyodor Dostoevsky',
		id: "afa5de03-344d-11e9-a414-719c6709cf3e",
		genres: ['classic', 'crime']
	},
	{
		title: 'The Demon ',
		published: 1872,
		author: 'Fyodor Dostoevsky',
		id: "afa5de04-344d-11e9-a414-719c6709cf3e",
		genres: ['classic', 'revolution']
	},

]


const typeDefs = `
enum YesNo {  YES  NO}
	type Book {
		title: String!
		published:Int!
		author: Author!
		id: ID!
		genres:[String!]!  
}
type Author {
		name:String!
		id: ID!
		born: Int
		bookCount: Int 
		books: [Book!]
}
  type Query {
    bookCount: Int!
		authorCount: Int!
		allBooks(author: String, genre: String):[Book!]!
		allAuthors: [Author!]!
		findAuthor(name: String!): Author
		findBook(title: String!): Book
  }
type Mutation {
  addBook(
    title: String!
		published:Int!
		author: String!
		genres:[String!]!
  ): Book
editAuthor(
    name: String! 
    setBornTo: Int!
  ): Author

}
`

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
					// If the author doesn't exist, return an empty array
					return []
				}
			}
			if (args.genre) {
				query.genres = args.genre
			}
			return await Book.find(query).populate('author')
		},
		allAuthors: async () => {
			const authors = await Author.find({})
			const authorPromises = authors.map(async (author) => {
				const authorBooks = await Book.find({ author: author._id })
				const bookCount = authorBooks.length

				return {
					...author.toObject(), // toObject() is for converting Moongoose specific document represantation into plain JS objects, without it we would have not an author info at all
					bookCount,
					books: authorBooks,
				}
			})
			return Promise.all(authorPromises)
		},
		findAuthor: async (root, args) => {
			let author = await Author.findOne({ name: args.name })
			if (!author) {
				return null
			}
			const authorBooks = await Book.find({ author: author._id })
			const bookCount = authorBooks.length
			return {
				...author.toObject(),
				bookCount,
				books: authorBooks,
			}
		},
		findBook: async (root, args) => {
			const book = await Book.findOne({ title: args.title }).populate('author')
			if (!book) {
				return null
			}

			const author = await Author.findById(book.author)//book.author here is ObjectId, not an object

			const authorBooks = await Book.find({ author: author._id })
			const bookCount = authorBooks.length

			console.log(book)
			return {
				...book.toObject(),
				author: {
					...author.toObject(),
					bookCount,
					books: authorBooks,

				}

				//despite that findOne returns plain JavaScript object, when we return object and spreading a book, we need to use toObject() 
			}
		}
	},
	Mutation: {
		addBook: async (root, args) => {
			let author = await Author.findOne({ name: args.author })
			if (!author) {
				author = new Author({ name: args.author })
				await author.save()
			}
			const book = new Book({ ...args, author: author._id })
			await book.save()
			return book


		},
		editAuthor: async (root, args) => {
			const author = await Author.findOne({ name: args.name })

			if (!author) {
				return null
			}

			author.born = args.setBornTo
			await author.save()
			const authorBooks = await Book.find({ author: author._id })
			const bookCount = authorBooks.length
			return {
				...author.toObject(),
				bookCount,
				books: authorBooks,
			}
		}
	}
}

const server = new ApolloServer({
	typeDefs,
	resolvers,
})

startStandaloneServer(server, {
	listen: { port: 4000 },
}).then(({ url }) => {
	console.log(`Server ready at ${url}`)
})