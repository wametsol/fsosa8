const { ApolloServer, UserInputError, gql } = require('apollo-server')
require('dotenv').config()
const mongoose = require('mongoose')
const Author = require('./src/models/author')
const Book = require('./src/models/book')
const User = require('./src/models/user')
const jwt = require('jsonwebtoken')


mongoose.set('useFindAndModify', false)



console.log('connecting to: ', process.env.MONGODB_URI)

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message)
  })

/*
let authors = [
  {
    name: 'Robert Martin',
    id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
    born: 1952
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
*/
/*
 * Saattaisi olla järkevämpää assosioida kirja ja sen tekijä tallettamalla kirjan yhteyteen tekijän nimen sijaan tekijän id
 * Yksinkertaisuuden vuoksi tallennamme kuitenkin kirjan yhteyteen tekijän nimen
*/
/*
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
*/
const typeDefs = gql`
  type User {
      username: String!
      favoriteGenre: String!
      id: ID!
  }

  type Genre {
    genre: String!
  }

  type Token {
    value: String!
  }

  type Author {
      name: String!
      id: ID!
      born: Int
      bookCount: Int
  }
  
  type Book {
      title: String!
      published: Int!
      author: Author!
      id: ID!
      genres: [String!]!
  }

  type Query {
      bookCount: Int!
      authorCount: Int!
      allBooks(author: ID, genre: String): [Book!]!
      allAuthors: [Author!]!
      me: User
  }

  type Mutation {
      createUser(
        username: String!
        favoriteGenre: String!
      ): User
      login(
        username: String!
        password: String!
      ): Token
      addBook(
          title: String!
          author: String!
          published: Int!
          genres:[String!]!
      ): Book
      addAuthor(
          name: String!
          id: ID!
          born: Int
      ): Author
      editAuthor(
          name: String!
          setBornTo: Int!
      ): Author
  }
`

const resolvers = {
    Query: {
        bookCount: () => Book.collection.countDocuments(),
        authorCount: () => Author.collection.countDocuments(),
        allBooks: (root, args) => {
          /*
            var authorBooks = books
            if(args.author) authorBooks = authorBooks.filter(p => p.author === args.author)
            if(args.genre) authorBooks = authorBooks.filter(p => p.genres.includes(args.genre))
            return authorBooks
            */
           console.log(args)
           if(args.genre) return Book.find({genres: { $in: args.genre } })
           return Book.find({})
        },
        allAuthors: () => {
          return Author.find({})
        },
        me: (root, args, context) => {
          return context.currentUser
        }
    },
    Author: {
      bookCount: async (root) =>(await Book.find({author: root.id})).length
    },
    Book: {
      author: async (root) => await Author.findById(root.author)
    },
    Mutation: {
      
      createUser: (root, args) => {
        const user = new User({ username: args.username, favoriteGenre: args.favoriteGenre })
        return user.save()
          .catch(error => {
            throw new UserInputError(error.message, {
              invalidArgs: args,
            })
          })
      },
      login: async (root, args) => {
        const user = await User.findOne({ username: args.username })
        if( !user || args.password !== '123123'){
          throw new UserInputError("Wrong credentials")
        }

        const userForToken = {
          username: user.username,
          id: user._id,
        }

        return { value: jwt.sign(userForToken, process.env.JWT_SECRET)}
      },
      addBook: async (root, args, context) => {
        const currentUser = context.currentUser
        if(!currentUser){
          throw new AuthenticationError("not authenticated")
        }
        const book = new Book({ ...args })
        let author = await Author.findOne({name: args.author})
        if(!author){
          console.log('Kirjailijaa ei ole, lisätään se!')
          const newAuthor = new Author({
            name: args.author
            })
            try{
              author = await newAuthor.save()
            } catch (error){
              throw new UserInputError(error.message,{
                invalidArgs: args,
              })
            }
        }
        book.author = author.id
        try{
          book.save()
        } catch (error){
          throw new UserInputError(error.message, {
            invalidArgs: args,
          })
        }
        return book
      },
      addAuthor: (root, args) => {
          const newAuthor = new Author({
              name: args.author
          })
          return newAuthor.save()
      },
      editAuthor: async (root, args, context) => {
        const currentUser = context.currentUser
        if(!currentUser){
          throw new AuthenticationError("not authenticated")
        }
        const author = await Author.findOne({name: args.name})
        if (!author) return null
        
        author.born = args.setBornTo
        try {
          author.save()
        } catch (error){
          throw new UserInputError(error.message, {
            invalidArgs: args,
          })
        }
        return author
      }
    }

}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.toLowerCase().startsWith('bearer ')){
      const decodedToken = jwt.verify(
        auth.substring(7), process.env.JWT_SECRET
      )
      const currentUser = await User
        .findById(decodedToken.id)
      return { currentUser }
    }
  }
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})